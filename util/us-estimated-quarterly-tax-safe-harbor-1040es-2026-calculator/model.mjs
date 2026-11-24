export const DEADLINES = Object.freeze([
  '2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'
]);
export const PENALTY_END = '2027-04-15';

const YEAR_START = '2026-01-01';
const RATE_STARTS = ['2026-04-01', '2026-07-01', '2026-10-01', '2027-01-01', '2027-04-01'];
const DAY_MS = 86400000;
// One dollar is 40,000 units. Percentages and four equal installments stay exact.
const UNITS_PER_DOLLAR = 40000;
const dollars = units => units / UNITS_PER_DOLLAR;
const roundUpToCent = units => Math.ceil(units / 400) / 100;

function toCents(value, min = 0, max = 1_000_000_000) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < min || value > max ||
      Math.abs(value * 100 - cents) > 0.00002) {
    throw new RangeError('Enter a valid amount with up to two decimal places.');
  }
  return cents;
}

function validateDate(date) {
  const time = Date.parse(date);
  if (typeof date !== 'string' || !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== date ||
      date < YEAR_START || date > PENALTY_END) {
    throw new RangeError('Enter a date from January 1, 2026 through April 15, 2027.');
  }
}

function estimatePenalty(target, withholding, payments, rates) {
  const timeline = new Map([...RATE_STARTS, ...DEADLINES, PENALTY_END].map(date => [date, 0]));
  for (const { date, units } of payments) {
    timeline.set(date, (timeline.get(date) ?? 0) + units);
  }

  const dueShortfalls = [];
  let balance = 0;
  let rate = 0;
  let previous = YEAR_START;
  let penalty = 0;

  for (const date of [...timeline.keys()].sort()) {
    const days = (Date.parse(date) - Date.parse(previous)) / DAY_MS;
    penalty += dollars(Math.max(0, balance)) * (rate / 100) * (days / 365);
    balance -= timeline.get(date);
    if (DEADLINES.includes(date)) {
      balance += (target - withholding) / 4;
      dueShortfalls.push(dollars(Math.max(0, balance)));
    }
    const rateIndex = RATE_STARTS.indexOf(date);
    if (rateIndex !== -1) rate = rates[rateIndex];
    previous = date;
  }

  return { penalty: Math.round(penalty * 100) / 100, dueShortfalls };
}

export function calculateSafeHarbor({
  currentTax, priorTax, priorAgi, filing, priorRule, withholding, asOf, payments,
  extraWithholding = 0, rates = [7, 7, 7, 7, 7]
}) {
  const currentCents = toCents(currentTax);
  const priorCents = toCents(priorTax);
  const agiCents = toCents(priorAgi, -1_000_000_000);
  const withholdingCents = toCents(withholding);
  const extraCents = toCents(extraWithholding);

  if (!['single', 'mfj', 'mfs', 'hoh', 'qss'].includes(filing) ||
      !['full-year', 'unavailable', 'no-liability'].includes(priorRule)) {
    throw new RangeError('Select a valid filing status and prior-year rule.');
  }
  if (!Array.isArray(rates) || rates.length !== RATE_STARTS.length) {
    throw new RangeError('Enter a rate for each calendar quarter in the estimate.');
  }
  for (const rate of rates) toCents(rate, 0, 100);
  validateDate(asOf);
  const vouchers = payments.map(({ date, amount }) => {
    validateDate(date);
    return { date, units: toCents(amount) * 400 };
  });

  const agiThreshold = filing === 'mfs' ? 75000 : 150000;
  const priorPercent = agiCents > agiThreshold * 100 ? 110 : 100;
  const currentTarget = currentCents * 90 * 4;
  const priorTarget = priorRule === 'full-year' ? priorCents * priorPercent * 4 : null;
  const annualTarget = priorRule === 'no-liability' ? 0 : Math.min(currentTarget, priorTarget ?? currentTarget);

  const targetAfterException = cents => currentCents - cents < 100000 ? 0 : annualTarget;
  const baseTarget = targetAfterException(withholdingCents);
  const baseWithholding = withholdingCents * 400;
  const paid = vouchers.reduce((total, voucher) => total + (voucher.date <= asOf ? voucher.units : 0), 0);
  const remaining = Math.max(0, baseTarget - baseWithholding - paid);
  const nextIndex = DEADLINES.findIndex(date => date >= asOf);
  const remainingQuarters = nextIndex === -1 ? 0 : DEADLINES.length - nextIndex;
  const nextDue = Math.max(0, (baseTarget - baseWithholding) * (nextIndex + 1) / 4 - paid);

  const extraUnits = extraCents * 400;
  const catchUpTarget = targetAfterException(withholdingCents + extraCents);
  const voucherCatchUpPayments = [...vouchers, { date: DEADLINES[3], units: extraUnits }];

  return {
    agiThreshold,
    priorMultiplier: priorRule === 'full-year' ? priorPercent / 100 : null,
    currentTarget: dollars(currentTarget),
    priorTarget: priorTarget === null ? null : dollars(priorTarget),
    safeHarborTarget: dollars(baseTarget),
    exception: priorRule === 'no-liability' ? 'prior-no-liability' :
      currentCents - withholdingCents < 100000 ? 'under-1000' : null,
    paidAsOf: dollars(paid),
    remainingSafeHarborNeeded: roundUpToCent(remaining),
    remainingQuarters,
    perQuarterPayment: remainingQuarters ? roundUpToCent(remaining / remainingQuarters) : null,
    nextDeadline: DEADLINES[nextIndex] ?? null,
    nextInstallmentNeeded: remainingQuarters ? roundUpToCent(nextDue) : null,
    baseline: estimatePenalty(baseTarget, baseWithholding, vouchers, rates),
    withholdingCatchUp: estimatePenalty(catchUpTarget, baseWithholding + extraUnits, vouchers, rates),
    voucherCatchUp: estimatePenalty(baseTarget, baseWithholding, voucherCatchUpPayments, rates)
  };
}
