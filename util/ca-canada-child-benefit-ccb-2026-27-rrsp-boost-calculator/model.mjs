const LOWER_THRESHOLD = 38237;
const UPPER_THRESHOLD = 82847;
const REDUCTION_RATES = [
  [0, 0],
  [0.07, 0.032],
  [0.135, 0.057],
  [0.19, 0.08],
  [0.23, 0.095],
];

function requireNonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite, nonnegative number.`);
  }
}

export function calculateCcb({ afni, underSix, ageSixToSeventeen }) {
  requireNonnegative(afni, 'Adjusted family net income');
  for (const count of [underSix, ageSixToSeventeen]) {
    if (!Number.isInteger(count) || count < 0 || count > 6) {
      throw new RangeError('Each child count must be a whole number from 0 to 6.');
    }
  }

  const maximum = underSix * 8157 + ageSixToSeventeen * 6883;
  const [lowerRate, upperRate] = REDUCTION_RATES[Math.min(underSix + ageSixToSeventeen, 4)];
  const lowerIncome = Math.max(0, Math.min(afni, UPPER_THRESHOLD) - LOWER_THRESHOLD);
  const upperIncome = Math.max(0, afni - UPPER_THRESHOLD);
  // Carry the full tier-one reduction into tier two without whole-dollar rounding.
  const reduction = lowerIncome * lowerRate + upperIncome * upperRate;
  const annual = Math.max(0, maximum - reduction);
  return { afni, maximum, reduction, annual, monthly: annual / 12 };
}

export function calculateDeductionImpact({ afni, underSix, ageSixToSeventeen, deduction, marginalTaxRate }) {
  requireNonnegative(deduction, 'Deduction');
  requireNonnegative(marginalTaxRate, 'Marginal tax rate');
  if (marginalTaxRate > 100) {
    throw new RangeError('Marginal tax rate must be between 0% and 100%.');
  }

  const before = calculateCcb({ afni, underSix, ageSixToSeventeen });
  const after = calculateCcb({ afni: Math.max(0, afni - deduction), underSix, ageSixToSeventeen });
  const annualBoost = after.annual - before.annual;
  const taxSavings = deduction * (marginalTaxRate / 100);
  const combinedSavings = taxSavings + annualBoost;
  const effectiveReturn = deduction === 0 ? null : (combinedSavings / deduction) * 100;
  return { before, after, annualBoost, taxSavings, combinedSavings, effectiveReturn };
}
