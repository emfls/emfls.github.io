export const DUE_DATES = Object.freeze([
  '2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15',
]);

export const PENALTY_END_DATE = '2027-04-15';
const MILLISECONDS_PER_DAY = 86_400_000;
const UNITS_PER_DOLLAR = 10_000;
const MAX_DOLLARS = 1_000_000_000;

function toUnits(value, name, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum || value > MAX_DOLLARS) {
    throw new RangeError(name + ' must be a dollar amount within the supported range.');
  }
  const cents = Math.round(value * 100);
  if (value !== cents / 100) {
    throw new RangeError(name + ' must have at most two decimal places.');
  }
  return cents * 100;
}

export function calculateEstimatedTax({
  filingStatus,
  prior2025Agi,
  prior2025TotalTax,
  projected2026TotalTax,
  totalW2Withholding,
  quarterlyPayments,
  annualPenaltyRate = 7,
}) {
  if (!['single', 'mfj', 'hoh', 'mfs'].includes(filingStatus)) {
    throw new RangeError('Select a filing status.');
  }
  if (!Array.isArray(quarterlyPayments) || quarterlyPayments.length !== DUE_DATES.length) {
    throw new RangeError('Enter four quarterly payments.');
  }
  if (!Number.isFinite(annualPenaltyRate) || annualPenaltyRate < 0 || annualPenaltyRate > 100) {
    throw new RangeError('Enter an annual penalty rate between 0% and 100%.');
  }

  const agi = toUnits(prior2025Agi, '2025 AGI', -MAX_DOLLARS);
  const priorTax = toUnits(prior2025TotalTax, '2025 tax');
  const currentTax = toUnits(projected2026TotalTax, 'Projected 2026 tax');
  const withholding = toUnits(totalW2Withholding, '2026 withholding');
  const agiThreshold = filingStatus === 'mfs' ? 75_000 : 150_000;
  const priorYearPercent = agi > agiThreshold * UNITS_PER_DOLLAR ? 110 : 100;

  // Hundredths of a cent keep the percentage and threshold comparisons exact.
  const currentYearProng = currentTax / 100 * 90;
  const priorYearProng = priorTax / 100 * priorYearPercent;
  let winningRule = 'tie';
  if (currentYearProng < priorYearProng) winningRule = 'current';
  if (priorYearProng < currentYearProng) winningRule = 'prior';

  const requiredAnnual = Math.min(currentYearProng, priorYearProng);
  const deMinimis = currentTax - withholding < 1_000 * UNITS_PER_DOLLAR;
  const netEstimatedNeeded = deMinimis ? 0 : Math.max(0, requiredAnnual - withholding);
  const equalPayment = netEstimatedNeeded / DUE_DATES.length;
  const quarterlyPaymentCents = Math.ceil(equalPayment / 100);
  let balance = 0;
  let estimatedPenalty = 0;

  const schedule = DUE_DATES.map((date, index) => {
    const payment = toUnits(quarterlyPayments[index], 'Q' + (index + 1) + ' payment');
    // A signed balance carries excess payments forward and applies new payments to past shortfalls first.
    balance += equalPayment - payment;
    const shortfall = Math.max(0, balance) / UNITS_PER_DOLLAR;
    const nextDate = DUE_DATES[index + 1] ?? PENALTY_END_DATE;
    const days = (Date.parse(nextDate) - Date.parse(date)) / MILLISECONDS_PER_DAY;
    estimatedPenalty += shortfall * annualPenaltyRate / 100 * days / 365;

    return {
      date,
      minimumPayment: quarterlyPaymentCents / 100,
      plannedPayment: payment / UNITS_PER_DOLLAR,
      shortfall,
    };
  });

  return {
    agiThreshold,
    priorYearPercent,
    currentYearProng: currentYearProng / UNITS_PER_DOLLAR,
    priorYearProng: priorYearProng / UNITS_PER_DOLLAR,
    winningRule,
    requiredAnnual: requiredAnnual / UNITS_PER_DOLLAR,
    deMinimis,
    netEstimatedNeeded: netEstimatedNeeded / UNITS_PER_DOLLAR,
    equalPayment: equalPayment / UNITS_PER_DOLLAR,
    quarterlyPayment: quarterlyPaymentCents / 100,
    yearEndShortfall: schedule.at(-1).shortfall,
    hasUnderpayment: schedule.some((quarter) => quarter.shortfall > 0),
    estimatedPenalty: Math.round(estimatedPenalty * 100) / 100,
    schedule,
  };
}
