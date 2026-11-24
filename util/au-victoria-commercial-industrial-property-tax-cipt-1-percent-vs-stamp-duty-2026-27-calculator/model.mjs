export const HORIZON = 25;
const TRANSITION = 10;
const MAX_VALUE = 1_000_000_000;
const TCV_DUTY_LIMIT = 1_930_000;

function check(value, min, max, label, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${integer ? 'a whole number ' : ''}from ${min} to ${max}.`);
  }
}

export function duty(value) {
  check(value, 0, MAX_VALUE, 'Dutiable value');
  const cents = Math.round(value * 100);
  if (cents / 100 !== value) throw new RangeError('Use at most two decimal places for dutiable value.');

  // Integer arithmetic preserves section 28 rounding, including exact half-dollar ties.
  const bands = [
    [25_000, 0, 0, 140],
    [130_000, 350, 25_000, 240],
    [960_000, 2_870, 130_000, 600],
    [2_000_000, 0, 0, 550],
    [MAX_VALUE, 110_000, 2_000_000, 650]
  ];
  const [, base, threshold, rate] = bands.find(([limit]) => cents <= limit * 100);
  const scaledDuty = base * 1_000_000 + (cents - threshold * 100) * rate;
  return Math.floor((scaledDuty + 499_999) / 1_000_000);
}

export function firstCiptCalendarYear(entryYear) {
  check(entryYear, 2024, 9999 - HORIZON, 'Entry year', true);
  return entryYear + TRANSITION + 1;
}

export function annualRepayment(principal, ratePercent) {
  check(principal, 0, MAX_VALUE, 'Loan principal');
  check(ratePercent, 0, 100, 'Loan interest rate');
  const rate = ratePercent / 100;
  if (rate === 0) return principal / TRANSITION;
  const factor = -Math.expm1(-TRANSITION * Math.log1p(rate)) / rate;
  return principal / factor;
}

export function project({
  value, site, purchaseYear, priorEntryYear, growth, discount, tax, loanRate, useLoan, buildToRent
}) {
  check(value, 1, MAX_VALUE, 'Dutiable value');
  check(site, 0, MAX_VALUE, 'Site value');
  check(purchaseYear, 2024, 9999 - HORIZON, 'Purchase year', true);
  check(priorEntryYear, 2024, purchaseYear, 'Original entry year', true);
  check(growth, -100, 100, 'Site-value growth');
  check(discount, 0, 100, 'Discount rate');
  check(tax, 0, 100, 'Effective deduction benefit');
  check(loanRate, 0, 100, 'Loan interest rate');
  if (typeof useLoan !== 'boolean' || typeof buildToRent !== 'boolean') {
    throw new RangeError('Choose a valid financing method and CIPT rate.');
  }

  const dutySaved = duty(value);
  const loanPayment = dutySaved > 0 && dutySaved <= TCV_DUTY_LIMIT
    ? annualRepayment(dutySaved, loanRate) : null;
  if (useLoan && loanPayment === null) {
    throw new RangeError('TCV financing requires positive duty of up to A$1.93 million. Select upfront cash.');
  }

  const firstEntryYear = firstCiptCalendarYear(purchaseYear);
  const firstResaleYear = Math.max(purchaseYear + 1, firstCiptCalendarYear(priorEntryYear));
  const ciptRate = buildToRent ? 0.005 : 0.01;
  const netFactor = 1 - tax / 100;
  const rows = [];
  let entryTotal = 0;
  let resaleTotal = 0;
  let entryPV = 0;
  let resalePV = 0;

  for (let year = 0; year <= HORIZON; year++) {
    const calendarYear = purchaseYear + year;
    const siteValue = site * (1 + growth / 100) ** year;
    const entryGross = calendarYear >= firstEntryYear ? siteValue * ciptRate : 0;
    const resaleGross = calendarYear >= firstResaleYear ? siteValue * ciptRate : 0;
    let financing = 0;
    if (year === 0 && !useLoan) financing = dutySaved;
    if (useLoan && year > 0 && year <= TRANSITION) financing = loanPayment;

    const entryAnnual = financing + entryGross * netFactor;
    const resaleAnnual = resaleGross * netFactor;
    const divisor = (1 + discount / 100) ** year;
    entryTotal += entryAnnual;
    resaleTotal += resaleAnnual;
    entryPV += entryAnnual / divisor;
    resalePV += resaleAnnual / divisor;
    rows.push({
      year, calendarYear, entryGross, resaleGross, entryAnnual, resaleAnnual,
      entryTotal, resaleTotal, entryPV, resalePV
    });
  }

  // Breakeven is the first annual payment that strictly overtakes the cash duty benchmark.
  const crossing = key => rows.find(row => (
    row[key] - dutySaved > Math.max(row[key], dutySaved) * Number.EPSILON * HORIZON
  ))?.year ?? null;

  return {
    dutySaved, firstEntryYear, firstResaleYear, loanPayment, rows,
    nominalBreakeven: crossing('resaleTotal'),
    npvBreakeven: crossing('resalePV')
  };
}
