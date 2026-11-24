export const RULES = Object.freeze({
  under_fra_all_year: Object.freeze({ annualLimit: 24480, monthlyLimit: 2040, divisor: 2 }),
  reaching_fra_this_year: Object.freeze({ annualLimit: 65160, monthlyLimit: 5430, divisor: 3 }),
  at_or_above_fra: Object.freeze({ annualLimit: null, monthlyLimit: null, divisor: null })
});

function rulesFor(mode) {
  if (!Object.hasOwn(RULES, mode)) throw new RangeError('Choose a valid full retirement age category.');
  return RULES[mode];
}

function wholeNumber(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function cents(value, min, label) {
  const rounded = Math.round(value * 100);
  if (!Number.isFinite(value) || value < min || value > 1e9 || rounded / 100 !== value) {
    throw new RangeError(`${label} must be between $${min} and $1 billion, with up to two decimal places.`);
  }
  return rounded;
}

function preFraMonthCount(mode, preFraMonths) {
  if (mode === 'at_or_above_fra') return 0;
  if (mode === 'under_fra_all_year') return 12;
  return wholeNumber(preFraMonths, 1, 11, 'Months before FRA');
}

function reductionUnits(months) {
  // One unit is 1/720 of PIA. Each month costs four or three units.
  return Math.min(months, 36) * 4 + Math.max(0, months - 36) * 3;
}

export function reductionRate(months) {
  return reductionUnits(wholeNumber(months, 0, 60, 'Reduction months')) / 720;
}

export function calculateEarningsTest({
  mode, monthlyBenefit, pia, monthsClaimedEarly, earnedIncome, preFraEarnedIncome,
  preFraMonths, benefitStartMonth = 1
}) {
  const rule = rulesFor(mode);
  const benefitCents = cents(monthlyBenefit, 0.01, 'Monthly benefit');
  const start = wholeNumber(benefitStartMonth, 1, 12, 'Benefit start month');
  const preFra = preFraMonthCount(mode, preFraMonths);
  const eligibleMonths = Math.max(0, preFra - start + 1);
  const eligibleCents = eligibleMonths * benefitCents;
  const scheduledCents = (13 - start) * benefitCents;

  let excessCents = 0;
  let earlyMonths = 0;
  let piaCents = 0;
  if (rule.divisor !== null) {
    const earnings = mode === 'reaching_fra_this_year' ? preFraEarnedIncome : earnedIncome;
    excessCents = Math.max(0, cents(earnings, 0, 'Countable earnings') - rule.annualLimit * 100);
    earlyMonths = wholeNumber(monthsClaimedEarly, 1, 60, 'Months claimed early');
    piaCents = cents(pia, 0.01, 'Full retirement age benefit');
  }

  // Keep the numerator in integer cents through the ceiling so exact multiples
  // of a benefit check cannot pick up an extra month through floating-point error.
  const divisor = rule.divisor ?? 1;
  const deductionNumerator = Math.min(eligibleCents * divisor, excessCents);
  const fullMonthsWithheld = Math.ceil(deductionNumerator / (benefitCents * divisor));
  const grossCents = fullMonthsWithheld * benefitCents;
  const creditMonths = Math.min(earlyMonths, fullMonthsWithheld);
  const remainingEarlyMonths = earlyMonths - creditMonths;
  const unitsBefore = reductionUnits(earlyMonths);
  const unitsAfter = reductionUnits(remainingEarlyMonths);
  const monthlyBoost = piaCents * (unitsBefore - unitsAfter) / 72000;
  const actualWithheld = deductionNumerator / (100 * divisor);

  return {
    eligibleMonths,
    annualBenefitsPayable: eligibleCents / 100,
    scheduledBenefits: scheduledCents / 100,
    rawWithholding: excessCents / (100 * divisor),
    actualWithheld,
    fullMonthsWithheld,
    grossWithheld: grossCents / 100,
    excessWithheld: (grossCents * divisor - deductionNumerator) / (100 * divisor),
    cashPayable: (scheduledCents - grossCents) / 100,
    creditMonths,
    remainingEarlyMonths,
    baselineBenefit: rule.divisor === null ? null : piaCents * (720 - unitsBefore) / 72000,
    adjustedBenefit: rule.divisor === null ? null : piaCents * (720 - unitsAfter) / 72000,
    monthlyBoost,
    breakEvenYears: monthlyBoost > 0 ? actualWithheld / (monthlyBoost * 12) : null
  };
}

export function checkMonthlySafeHarbor({
  mode, preFraMonths, benefitStartMonth = 1, month, wages, substantialServices
}) {
  const { monthlyLimit } = rulesFor(mode);
  const preFra = preFraMonthCount(mode, preFraMonths);
  const start = wholeNumber(benefitStartMonth, 1, 12, 'Benefit start month');
  const selectedMonth = wholeNumber(month, 1, 12, 'Month to check');
  if (selectedMonth < start) return { status: 'not_entitled', monthlyLimit };
  if (selectedMonth > preFra) return { status: 'exempt', monthlyLimit: null };

  const wageCents = cents(wages, 0, 'Wages for selected month');
  if (typeof substantialServices !== 'boolean') {
    throw new RangeError('Specify whether you performed substantial self-employment services.');
  }
  if (substantialServices) return { status: 'substantial_services', monthlyLimit };
  if (wageCents > monthlyLimit * 100) return { status: 'over_limit', monthlyLimit };
  return { status: 'protected', monthlyLimit };
}
