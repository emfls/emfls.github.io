export const TAX_YEAR = 2026;
export const MAX_CREDIT_PER_CHILD = 17670;
export const MAX_REFUNDABLE_PER_CHILD = 5120;
export const PHASE_OUT_START = 265080;
export const PHASE_OUT_END = 305080;
export const CARRYFORWARD_YEARS = 5;

const isNonnegative = value => Number.isFinite(value) && value >= 0;

// Planning scenario: scale the refundable cap along with the credit.
// Draft Form 8839 instead applies a fixed cap to each child's reduced credit.
export function calculateAdoptionCredit({
  numChildren, totalExpenses, employerExclusion, isSpecialNeeds, magi, federalTaxLiability,
}) {
  if (!Number.isSafeInteger(numChildren) || numChildren < 1) {
    throw new RangeError('Enter a positive whole number of eligible children.');
  }
  if (![totalExpenses, employerExclusion, federalTaxLiability].every(isNonnegative)
      || !Number.isFinite(magi) || typeof isSpecialNeeds !== 'boolean') {
    throw new RangeError('Enter a valid MAGI and nonnegative amounts for expenses, assistance, and tax.');
  }

  const maximumCredit = MAX_CREDIT_PER_CHILD * numChildren;
  const qualifyingExpensesForCredit = isSpecialNeeds
    ? maximumCredit
    : Math.min(maximumCredit, Math.max(0, totalExpenses - employerExclusion));
  const phaseOutWidth = PHASE_OUT_END - PHASE_OUT_START;
  const phaseOutFactor = Math.max(0, Math.min(1, (PHASE_OUT_END - magi) / phaseOutWidth));
  const creditAfterPhaseOut = qualifyingExpensesForCredit * phaseOutFactor;
  const refundableCap = Math.min(
    creditAfterPhaseOut, MAX_REFUNDABLE_PER_CHILD * numChildren * phaseOutFactor,
  );
  const nonRefundablePool = Math.max(0, creditAfterPhaseOut - refundableCap);
  const nonRefundableUsedThisYear = Math.min(federalTaxLiability, nonRefundablePool);
  const remainingTaxAfterNonRef = Math.max(0, federalTaxLiability - nonRefundableUsedThisYear);
  const refundableOffsettingTax = Math.min(remainingTaxAfterNonRef, refundableCap);
  const directCashRefundFromAdoption = Math.max(0, refundableCap - refundableOffsettingTax);
  const fiveYearCarryforward = Math.max(0, nonRefundablePool - nonRefundableUsedThisYear);

  return {
    qualifyingExpensesForCredit,
    phaseOutFactor,
    creditAfterPhaseOut,
    refundableCap,
    nonRefundablePool,
    nonRefundableUsedThisYear,
    remainingTaxAfterNonRef,
    refundableOffsettingTax,
    directCashRefundFromAdoption,
    fiveYearCarryforward,
  };
}

export function projectCarryforward(balance, availableTaxByYear) {
  if (!isNonnegative(balance) || !Array.isArray(availableTaxByYear)
      || availableTaxByYear.length !== CARRYFORWARD_YEARS
      || !Array.from(availableTaxByYear).every(isNonnegative)) {
    throw new RangeError('Enter nonnegative tax amounts for all five carryforward years.');
  }

  let remaining = balance;
  return availableTaxByYear.map((availableTax, index) => {
    const used = Math.min(availableTax, remaining);
    remaining -= used;
    const expired = index === CARRYFORWARD_YEARS - 1 ? remaining : 0;
    remaining -= expired;
    return { year: TAX_YEAR + index + 1, used, remaining, expired };
  });
}
