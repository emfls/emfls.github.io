export const FBT_RATE = 0.47;
export const GROSS_UP = Object.freeze({ type1: 2.0802, type2: 1.8868 });
export const STATUTORY_RATE = 0.20;
export const FBT_YEAR_DAYS = 365;
export const RFBA_THRESHOLD = 2000;
export const MAX_AMOUNT = 100_000_000;

function validateRange(label, value, max) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-AU')}.`);
  }
}

// Treat only floating-point round-off as equal. Keep fractional dollars through the tax calculation.
function compare(left, right, scale = Math.max(Math.abs(left), Math.abs(right))) {
  const difference = left - right;
  return Math.abs(difference) <= 4 * Number.EPSILON * scale ? 0 : Math.sign(difference);
}

function contributionInCents(amount, scale = amount) {
  const cents = amount * 100;
  const nearest = Math.round(cents);
  return (compare(cents, nearest, scale * 100) === 0 ? nearest : Math.ceil(cents)) / 100;
}

function calculateMethod(beforeContribution, employeeContributions, grossUp) {
  const taxableValue = compare(beforeContribution, employeeContributions) > 0
    ? beforeContribution - employeeContributions
    : 0;
  const grossedUpValue = taxableValue * grossUp;

  return {
    beforeContribution,
    taxableValue,
    grossedUpValue,
    fbtPayable: grossedUpValue * FBT_RATE,
    contributionToZero: contributionInCents(beforeContribution),
    additionalContributionToZero: contributionInCents(taxableValue, beforeContribution),
    rfba: compare(taxableValue, RFBA_THRESHOLD, beforeContribution) > 0
      ? taxableValue * GROSS_UP.type2
      : 0,
  };
}

export function calculateCarFbt({
  baseValue, ownedFourFullFbtYears, daysAvailable, runningCosts, leaseOrDeemedCosts,
  businessUsePct, employeeContributions, grossUpType,
}) {
  validateRange('Car base value', baseValue, MAX_AMOUNT);
  validateRange('Running costs', runningCosts, MAX_AMOUNT);
  validateRange('Lease or deemed costs', leaseOrDeemedCosts, MAX_AMOUNT);
  validateRange('Employee contributions', employeeContributions, MAX_AMOUNT);
  validateRange('Days available', daysAvailable, FBT_YEAR_DAYS);
  validateRange('Business use (%)', businessUsePct, 100);
  if (!Number.isInteger(daysAvailable)) throw new RangeError('Enter whole days of private availability.');
  if (typeof ownedFourFullFbtYears !== 'boolean') throw new TypeError('Choose whether the one-third reduction applies.');
  if (!Object.hasOwn(GROSS_UP, grossUpType)) throw new RangeError('Choose Type 1 or Type 2 gross-up.');

  const effectiveBaseValue = ownedFourFullFbtYears ? baseValue * (2 / 3) : baseValue;
  const totalOperatingCosts = runningCosts + leaseOrDeemedCosts;
  const privateUsePct = 100 - businessUsePct;
  const statutoryBefore = effectiveBaseValue * STATUTORY_RATE * (daysAvailable / FBT_YEAR_DAYS);
  const operatingBefore = totalOperatingCosts * (privateUsePct / 100);
  const grossUp = GROSS_UP[grossUpType];
  const statutory = calculateMethod(statutoryBefore, employeeContributions, grossUp);
  const operating = calculateMethod(operatingBefore, employeeContributions, grossUp);
  const comparison = compare(statutory.taxableValue, operating.taxableValue, Math.max(statutoryBefore, operatingBefore));

  // If statutory FBT is already zero, logbook can only match it.
  let breakEven = { kind: 'never' };
  if (statutory.taxableValue > 0) {
    breakEven = compare(totalOperatingCosts, statutoryBefore) < 0
      ? { kind: 'always', businessUsePct: 0 }
      : { kind: 'threshold', businessUsePct: 100 * (totalOperatingCosts - statutoryBefore) / totalOperatingCosts };
  }

  return {
    effectiveBaseValue,
    totalOperatingCosts,
    privateUsePct,
    statutory,
    operating,
    winner: comparison === 0 ? 'tie' : comparison > 0 ? 'operating' : 'statutory',
    fbtSaved: comparison === 0 ? 0 : Math.abs(statutory.fbtPayable - operating.fbtPayable),
    breakEven,
  };
}
