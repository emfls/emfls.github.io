export const PARAMETERS = Object.freeze({
  annualExemptAmount: 3000,
  personalAllowance: 12570,
  basicRateBand: 37700,
  basicRateThreshold: 50270,
  basicCgtRate: 0.18,
  higherCgtRate: 0.24,
  finalPeriodMonths: 9,
  extendedFinalPeriodMonths: 36,
  lettingReliefCap: 40000,
  reportingDays: 60,
});

/**
 * Month-based planning estimate for a UK resident's 2026/27 disposal.
 * Joint ownership assumes equal shares, identical residence histories and income,
 * and both annual exemptions available in full.
 */
export function calculatePRR({
  salePrice,
  purchasePrice,
  buyingSellingCosts,
  capitalImprovements,
  totalOwnershipMonths,
  actualOccupiedMonths,
  deemedOccupationMonths: claimedDeemedMonths,
  disabledOrCareHome,
  sharedOccupancyWithTenant,
  sharedLetMonths,
  numOwners,
  annualIncomeBeforePersonalAllowance,
}) {
  const amounts = [
    salePrice, purchasePrice, buyingSellingCosts, capitalImprovements,
    totalOwnershipMonths, actualOccupiedMonths, claimedDeemedMonths,
    annualIncomeBeforePersonalAllowance,
  ];
  if (amounts.some(amount => !Number.isFinite(amount) || amount < 0)) {
    throw new RangeError('Enter a valid non-negative number in each required field.');
  }
  if (totalOwnershipMonths === 0 || actualOccupiedMonths > totalOwnershipMonths) {
    throw new RangeError('Ownership must be greater than zero and cover all months lived in the home.');
  }
  if (sharedOccupancyWithTenant && (
    !Number.isFinite(sharedLetMonths) || sharedLetMonths < 0 || sharedLetMonths > actualOccupiedMonths
  )) {
    throw new RangeError('Shared letting months must fall within the time you lived in the home.');
  }
  if (numOwners !== 1 && numOwners !== 2) {
    throw new RangeError('Select one or two owners.');
  }

  const grossGain = salePrice - purchasePrice - buyingSellingCosts - capitalImprovements;
  if (!Number.isFinite(grossGain)) {
    throw new RangeError('The transaction amounts are too large to calculate a gain.');
  }
  const positiveGain = Math.max(0, grossGain);
  const nonOccupiedMonths = totalOwnershipMonths - actualOccupiedMonths;
  const wasMainHome = actualOccupiedMonths > 0;
  const deemedOccupationMonths = wasMainHome ? Math.min(claimedDeemedMonths, nonOccupiedMonths) : 0;
  const finalPeriodLimit = disabledOrCareHome ? PARAMETERS.extendedFinalPeriodMonths : PARAMETERS.finalPeriodMonths;
  const extraFinalPeriodMonths = wasMainHome
    ? Math.min(finalPeriodLimit, Math.max(0, nonOccupiedMonths - deemedOccupationMonths))
    : 0;
  const qualifyingMonths = Math.min(
    totalOwnershipMonths, actualOccupiedMonths + deemedOccupationMonths + extraFinalPeriodMonths,
  );
  const prrFraction = qualifyingMonths / totalOwnershipMonths;
  const prrExemptGain = positiveGain * prrFraction;

  // Requested time-only estimate. HMRC uses the chargeable gain attributable to
  // the part let during shared occupation, which can require a separate apportionment.
  const sharedLetGain = sharedOccupancyWithTenant ? positiveGain * (sharedLetMonths / totalOwnershipMonths) : 0;
  const lettingRelief = Math.min(prrExemptGain, sharedLetGain, PARAMETERS.lettingReliefCap);
  const remainingGainAfterReliefs = Math.max(0, grossGain - prrExemptGain - lettingRelief);
  const taxableGainPerOwner = Math.max(0, remainingGainAfterReliefs / numOwners - PARAMETERS.annualExemptAmount);
  const unusedBasicBand = Math.min(
    PARAMETERS.basicRateBand,
    Math.max(0, PARAMETERS.basicRateThreshold - annualIncomeBeforePersonalAllowance),
  );
  const gainAt18 = Math.min(taxableGainPerOwner, unusedBasicBand);
  const gainAt24 = Math.max(0, taxableGainPerOwner - gainAt18);
  const cgtDue = (gainAt18 * PARAMETERS.basicCgtRate + gainAt24 * PARAMETERS.higherCgtRate) * numOwners;

  return {
    grossGain, nonOccupiedMonths, deemedOccupationMonths, finalPeriodLimit, extraFinalPeriodMonths,
    qualifyingMonths, prrFraction, prrExemptGain, sharedLetGain, lettingRelief, remainingGainAfterReliefs,
    taxableGainPerOwner, unusedBasicBand, gainAt18, gainAt24, cgtDue,
  };
}
