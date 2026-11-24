export const RULES = Object.freeze({
  individualAllowance: 3_000,
  trustAllowance: 1_500,
  basicBand: 37_700,
  basicRate: 18,
  higherRate: 24,
  badrRate: 18,
  badrCap: 1_000_000,
  proposedBadrCap: 500_000,
  maxAmount: 10_000_000_000,
});

function toPence(amount) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > RULES.maxAmount || pence / 100 !== amount) {
    throw new RangeError('Enter a non-negative pound amount with up to two decimal places.');
  }
  return pence;
}

function assess(gain, allowance, losses, basicBand, qualifyingGain) {
  const allowanceUsed = Math.min(gain, allowance);
  const lossesUsed = Math.min(losses, gain - allowanceUsed);
  const deductions = allowanceUsed + lossesUsed;

  // BADR takes up the band first. Offset deductions against 24% gains first.
  const standardGain = gain - qualifyingGain;
  const basicBeforeDeductions = Math.min(standardGain, Math.max(0, basicBand - qualifyingGain));
  const higherBeforeDeductions = standardGain - basicBeforeDeductions;
  const higherGain = Math.max(0, higherBeforeDeductions - deductions);
  const remainingDeductions = Math.max(0, deductions - higherBeforeDeductions);
  const basicGain = Math.max(0, basicBeforeDeductions - remainingDeductions);
  const badrGain = Math.max(0, qualifyingGain - Math.max(0, remainingDeductions - basicBeforeDeductions));

  // Each product is in hundredths of a penny. Round for display only.
  const basicTax = basicGain * RULES.basicRate;
  const higherTax = higherGain * RULES.higherRate;
  const badrTax = badrGain * RULES.badrRate;
  return {
    taxableGain: (gain - deductions) / 100,
    lossesUsed: lossesUsed / 100,
    remainingLosses: (losses - lossesUsed) / 100,
    allowanceUsed: allowanceUsed / 100,
    basicGain: basicGain / 100,
    higherGain: higherGain / 100,
    badrGain: badrGain / 100,
    basicTax: basicTax / 10_000,
    higherTax: higherTax / 10_000,
    badrTax: badrTax / 10_000,
    total: (basicTax + higherTax + badrTax) / 10_000,
  };
}

export function calculateCgt({
  taxpayerType = 'individual',
  assetType = 'standard_shares_property',
  totalTaxableIncome = 0,
  grossPensionGiftAid = 0,
  grossGain = 0,
  broughtForwardLosses = 0,
  priorBadrUsed = 0,
  simulateSpouse = false,
  spouseDisposalGain = 0,
  spouseBasicBand = 0,
} = {}) {
  if (!['individual', 'trust'].includes(taxpayerType) ||
      !['standard_shares_property', 'badr_business'].includes(assetType)) {
    throw new RangeError('Choose a supported taxpayer and asset type.');
  }

  const individual = taxpayerType === 'individual';
  const business = assetType === 'badr_business';
  const gain = toPence(grossGain);
  const losses = toPence(broughtForwardLosses);
  const allowance = 100 * (individual ? RULES.individualAllowance : RULES.trustAllowance);
  const basicBand = individual
    ? Math.max(0, RULES.basicBand * 100 + toPence(grossPensionGiftAid) - toPence(totalTaxableIncome))
    : 0;
  const prior = business ? toPence(priorBadrUsed) : 0;
  const currentCap = business ? Math.max(0, RULES.badrCap * 100 - prior) : 0;
  const proposedCap = business ? Math.max(0, RULES.proposedBadrCap * 100 - prior) : 0;
  const current = assess(gain, allowance, losses, basicBand, Math.min(gain, currentCap));
  const standard = business ? assess(gain, allowance, losses, basicBand, 0) : current;
  const proposed = business ? assess(gain, allowance, losses, basicBand, Math.min(gain, proposedCap)) : current;

  let spouse = null;
  if (simulateSpouse && individual && !business) {
    const shifted = toPence(spouseDisposalGain);
    if (shifted > gain) throw new RangeError('The gain assigned to your spouse cannot exceed your total gain.');
    const own = assess(gain - shifted, allowance, losses, basicBand, 0);
    const partner = assess(shifted, allowance, 0, toPence(spouseBasicBand), 0);
    const combined = (Math.round(own.total * 10_000) + Math.round(partner.total * 10_000)) / 10_000;
    spouse = {
      ownTax: own.total,
      partnerTax: partner.total,
      combined,
      savings: taxDifference(current.total, combined),
    };
  }

  return {
    ...current,
    allowance: allowance / 100,
    basicBand: basicBand / 100,
    effectiveRate: gain ? current.total * 100 / grossGain : 0,
    standardTax: standard.total,
    badrSavings: taxDifference(standard.total, current.total),
    proposedTax: proposed.total,
    capIncreaseInTax: taxDifference(proposed.total, current.total),
    spouse,
  };
}

function taxDifference(first, second) {
  return (Math.round(first * 10_000) - Math.round(second * 10_000)) / 10_000;
}
