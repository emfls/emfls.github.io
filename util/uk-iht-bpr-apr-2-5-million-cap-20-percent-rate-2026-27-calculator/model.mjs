export const RULES = Object.freeze({
  individualCap: 2_500_000,
  individualNrb: 325_000,
  individualRnrb: 175_000,
  rnrbTaperThreshold: 2_000_000,
  partialReliefRate: 0.5,
  ihtRate: 0.4,
  instalmentYears: 10,
  maxAssetValue: 1_000_000_000
});

export function calculateIht({
  householdMode, aprValue, bprValue, aimSharesValue, otherAssets, availableNrb, availableRnrb
}) {
  if (householdMode !== 'individual' && householdMode !== 'married_couple_transferable') {
    throw new RangeError('Choose a valid household mode.');
  }

  const limits = [
    [aprValue, RULES.maxAssetValue],
    [bprValue, RULES.maxAssetValue],
    [aimSharesValue, RULES.maxAssetValue],
    [otherAssets, RULES.maxAssetValue],
    [availableNrb, 2 * RULES.individualNrb],
    [availableRnrb, 2 * RULES.individualRnrb]
  ];
  for (const [value, maximum] of limits) {
    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      throw new RangeError('Each amount must be within its allowed range.');
    }
  }

  const cap100 = RULES.individualCap * (householdMode === 'individual' ? 1 : 2);
  const combinedAprBpr = aprValue + bprValue;
  const full100Relief = Math.min(combinedAprBpr, cap100);
  const excessAprBpr = combinedAprBpr - full100Relief;
  const taxableExcessAprBpr = excessAprBpr * (1 - RULES.partialReliefRate);
  const taxableAimShares = aimSharesValue * (1 - RULES.partialReliefRate);
  const chargeableQualifyingAssets = taxableExcessAprBpr + taxableAimShares;

  const estateBeforeReliefs = combinedAprBpr + aimSharesValue + otherAssets;
  const rnrbTaper = Math.max(0, estateBeforeReliefs - RULES.rnrbTaperThreshold) / 2;
  const rnrbLost = Math.min(availableRnrb, rnrbTaper);
  const taperedRnrb = availableRnrb - rnrbLost;
  const totalAllowances = availableNrb + taperedRnrb;

  const totalChargeableEstateAfterReliefs = otherAssets + chargeableQualifyingAssets;
  const netTaxableEstate = Math.max(0, totalChargeableEstateAfterReliefs - totalAllowances);
  const totalIhtDue = netTaxableEstate * RULES.ihtRate;
  const oldNetTaxableEstate = Math.max(0, otherAssets - totalAllowances);
  const oldIhtDue = oldNetTaxableEstate * RULES.ihtRate;
  const reformTaxShock = (netTaxableEstate - oldNetTaxableEstate) * RULES.ihtRate;

  // Attribute tax using each asset group's share of chargeable value after reliefs.
  const instalmentEligibleIht = totalIhtDue === 0 ? 0 :
    totalIhtDue * (chargeableQualifyingAssets / totalChargeableEstateAfterReliefs);
  const annualInstalment = instalmentEligibleIht / RULES.instalmentYears;
  const ihtOutsidePlan = totalIhtDue - instalmentEligibleIht;

  return {
    cap100, combinedAprBpr, full100Relief, excessAprBpr, taxableExcessAprBpr, taxableAimShares,
    estateBeforeReliefs, rnrbLost, taperedRnrb, totalAllowances, totalChargeableEstateAfterReliefs,
    netTaxableEstate, totalIhtDue, oldIhtDue, reformTaxShock, instalmentEligibleIht,
    annualInstalment, ihtOutsidePlan, firstPaymentEstimate: ihtOutsidePlan + annualInstalment
  };
}
