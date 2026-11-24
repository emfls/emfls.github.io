export const DUE_DATES = Object.freeze(['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15']);
export const FILING_DEADLINE = '2027-04-15';
export const MAX_AMOUNT = 1_000_000_000;

export const RATE_PERIODS = Object.freeze([
  { from: '2026-01-01', through: '2026-03-31', rate: .07, projected: false },
  { from: '2026-04-01', through: '2026-06-30', rate: .06, projected: false },
  { from: '2026-07-01', through: '2026-09-30', rate: .07, projected: false },
  { from: '2026-10-01', through: '2026-12-31', rate: .07, projected: false },
  { from: '2027-01-01', through: FILING_DEADLINE, rate: .07, projected: true },
].map(period => Object.freeze(period)));

const MS_PER_DAY = 86_400_000;
// 40 units per cent preserves exact 90%, 110%, and equal-quarter allocations.
const UNITS_PER_CENT = 40;
const UNITS_PER_DOLLAR = 100 * UNITS_PER_CENT;
const toDay = iso => Date.parse(iso + 'T00:00:00Z') / MS_PER_DAY;
const dueDays = DUE_DATES.map(toDay);
const deadline = toDay(FILING_DEADLINE);
const rates = RATE_PERIODS.map(period => ({
  start: toDay(period.from) - 1,
  end: toDay(period.through),
  percent: Math.round(period.rate * 100),
}));

function cents(amount, label, allowNegative = false) {
  const rounded = Math.round(amount * 100);
  if (typeof amount !== 'number' || amount !== rounded / 100 ||
      Math.abs(amount) > MAX_AMOUNT || (!allowNegative && amount < 0)) {
    throw new RangeError(`${label} must be a valid dollar amount with up to two decimal places.`);
  }
  return rounded;
}

function normalizePayment(payment, index) {
  const entry = typeof payment === 'number' ? { amount: payment } : payment;
  const amount = cents(entry?.amount, `Q${index + 1} estimated payment`) * UNITS_PER_CENT;
  const date = entry.date ?? DUE_DATES[index];
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError(`Enter a valid Q${index + 1} payment date.`);
  }
  const day = toDay(date);
  if (!Number.isFinite(day) || new Date(day * MS_PER_DAY).toISOString().slice(0, 10) !== date ||
      day < toDay('2026-01-01') || day > deadline) {
    throw new RangeError(`Q${index + 1} payment date must be between January 1, 2026 and April 15, 2027.`);
  }
  return { day, amount };
}

// The worksheet counts days after a due date through the payment date.
function percentDays(from, through) {
  return rates.reduce((sum, period) =>
    sum + Math.max(0, Math.min(through, period.end) - Math.max(from, period.start)) * period.percent, 0);
}

const roundedPenalty = numerator => Math.round(numerator / (365 * UNITS_PER_DOLLAR)) / 100;

export function calculate({
  filingStatus, priorYearAgi, priorYearTax, currentYearTax, withholding,
  estimatedPayments, priorYearTreatment = 'eligible',
}) {
  if (!['single_mfj_hoh', 'mfs_75k'].includes(filingStatus)) {
    throw new RangeError('Select a filing status.');
  }
  if (!['eligible', 'unavailable', 'no-liability'].includes(priorYearTreatment)) {
    throw new RangeError('Select a prior-year tax treatment.');
  }
  if (!Array.isArray(estimatedPayments) || estimatedPayments.length !== 4) {
    throw new RangeError('Enter four estimated payment amounts, using zero for skipped payments.');
  }

  const agi = cents(priorYearAgi, '2025 adjusted gross income', true);
  const priorTax = cents(priorYearTax, '2025 tax');
  const currentTax = cents(currentYearTax, '2026 tax');
  const withheld = cents(withholding, '2026 withholding');
  const estimated = Array.from(estimatedPayments, normalizePayment);
  const higherAgi = agi > (filingStatus === 'mfs_75k' ? 7_500_000 : 15_000_000);
  const priorMultiplier = higherAgi ? 44 : 40;
  const currentTarget = currentTax * 36;
  const priorTarget = priorYearTreatment === 'eligible' ? priorTax * priorMultiplier : null;
  const noPriorLiability = priorYearTreatment === 'no-liability';
  const annual = noPriorLiability ? 0 : Math.min(currentTarget, priorTarget ?? currentTarget);
  const installment = annual / 4;
  const netTaxCents = currentTax - withheld;
  const exemption = noPriorLiability ? 'NO_PRIOR_LIABILITY' : netTaxCents < 100_000 ? 'DE_MINIMIS' : null;
  const quarters = dueDays.map((day, index) => ({
    dueDate: DUE_DATES[index], day, remaining: 0, newUnderpayment: 0, balanceDue: 0, penaltyNumerator: 0,
  }));

  let carry = 0;
  let installmentRescueCents = 0;
  let usesProjectedRate = false;
  const eventDays = [...new Set([...dueDays, deadline, ...estimated.map(payment => payment.day)])].sort((a, b) => a - b);
  let previousDay = eventDays[0];

  for (const day of eventDays) {
    const dayFactor = percentDays(previousDay, day);
    for (const quarter of quarters) {
      if (quarter.remaining > 0 && day > toDay('2026-12-31') && day > previousDay) {
        usesProjectedRate = true;
      }
      quarter.penaltyNumerator += quarter.remaining * dayFactor;
    }
    previousDay = day;

    carry += estimated.reduce((total, payment) => total + (payment.day === day ? payment.amount : 0), 0);
    const index = dueDays.indexOf(day);
    if (index !== -1 && !exemption) {
      quarters[index].remaining = installment;
      carry += withheld * (UNITS_PER_CENT / 4);
    }

    // Late payments satisfy the oldest installment. Excess carries forward.
    for (const quarter of quarters) {
      const applied = Math.min(carry, quarter.remaining);
      carry -= applied;
      quarter.remaining -= applied;
    }
    if (index !== -1) {
      const balance = quarters.reduce((sum, quarter) => sum + quarter.remaining, 0);
      quarters[index].newUnderpayment = quarters[index].remaining / UNITS_PER_DOLLAR;
      quarters[index].balanceDue = balance / UNITS_PER_DOLLAR;
      const extraCents = Math.ceil(balance / ((index + 1) * UNITS_PER_CENT / 4));
      installmentRescueCents = Math.max(installmentRescueCents, extraCents);
    }
  }

  const totalNumerator = quarters.reduce((sum, quarter) => sum + quarter.penaltyNumerator, 0);
  return {
    status: totalNumerator > 0 ? 'PENALTY_TRIGGERED' : 'SAFE_HARBOR_MET',
    exemption,
    priorYearMultiplier: priorMultiplier / UNITS_PER_CENT,
    priorYearTarget: priorTarget === null ? null : priorTarget / UNITS_PER_DOLLAR,
    currentYearTarget: currentTarget / UNITS_PER_DOLLAR,
    requiredAnnualPayment: annual / UNITS_PER_DOLLAR,
    requiredQuarterlyInstallment: installment / UNITS_PER_DOLLAR,
    withholdingPerInstallment: withheld / 400,
    totalPenalty: roundedPenalty(totalNumerator),
    usesProjectedRate,
    additionalWithholding: Math.min(installmentRescueCents, Math.max(0, netTaxCents - 99_999)) / 100,
    quarters: quarters.map(({ dueDate, newUnderpayment, balanceDue, penaltyNumerator }) => ({
      dueDate, newUnderpayment, balanceDue, penalty: roundedPenalty(penaltyNumerator),
    })),
  };
}
