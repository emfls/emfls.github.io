export const RULES = Object.freeze({
  personalAllowance: 12_570,
  allowanceTaperStart: 100_000,
  basicRateLimit: 37_700,
  higherRateLimit: 125_140,
  basicRate: 20,
  higherRate: 40,
  additionalRate: 45,
  giftAidGrossUp: 1.25,
  childBenefitThreshold: 60_000,
  childBenefitFullCharge: 80_000,
  childBenefitStep: 200,
});

const toPence = pounds => {
  const pence = Math.round(pounds * 100);
  if (!Number.isFinite(pounds) || pounds < 0 || pounds > 1_000_000_000 ||
      Math.abs(pounds * 100 - pence) > 0.0001) {
    throw new RangeError('Use a non-negative amount in pounds and pence up to £1 billion.');
  }
  return pence;
};

const personalAllowance = ani => Math.max(0, RULES.personalAllowance * 100 -
  Math.max(0, ani - RULES.allowanceTaperStart * 100) / 2);

// The allowance uses adjusted net income. Tax bands still apply to income before Gift Aid.
function incomeTax(income, allowance, extension) {
  const taxable = Math.max(0, income - allowance);
  const basicLimit = RULES.basicRateLimit * 100 + extension;
  const higherLimit = RULES.higherRateLimit * 100 + extension;
  const basic = Math.min(taxable, basicLimit);
  const higher = Math.max(0, Math.min(taxable, higherLimit) - basicLimit);
  const additional = Math.max(0, taxable - higherLimit);
  return (basic * RULES.basicRate + higher * RULES.higherRate + additional * RULES.additionalRate) / 100;
}

function childBenefitCharge(ani, benefit) {
  const percent = Math.min(100, Math.max(0,
    Math.floor((ani - RULES.childBenefitThreshold * 100) / (RULES.childBenefitStep * 100))));
  return { rate: percent / 100, amount: Math.floor(Math.floor(benefit / 100) * percent / 100) };
}

function netDonationToReach(ani, target) {
  // Round the cash gift up to a whole penny so the target is actually reached.
  return Math.ceil(Math.max(0, ani - target * 100) / RULES.giftAidGrossUp) / 100;
}

export function calculateGiftAid({
  baseAdjustedNetIncome,
  netDonation,
  annualChildBenefit = 0,
  capitalGainsTax = 0,
}) {
  const baseIncome = toPence(baseAdjustedNetIncome);
  const donation = toPence(netDonation);
  const benefit = toPence(annualChildBenefit);
  const cgt = toPence(capitalGainsTax);
  const gross = donation * RULES.giftAidGrossUp;
  const reclaim = gross - donation;
  const newIncome = Math.max(0, baseIncome - gross);
  const allowanceBefore = personalAllowance(baseIncome);
  const allowanceAfter = personalAllowance(newIncome);
  const taxBefore = incomeTax(baseIncome, allowanceBefore, 0);
  const taxAfter = incomeTax(baseIncome, allowanceAfter, gross);
  const refund = taxBefore - taxAfter;
  const trueCost = donation - refund;
  const taxAvailable = taxAfter + cgt;
  const shortfall = Math.max(0, reclaim - taxAvailable);
  // ITA 2007 sections 423–424 can restrict the allowance before charging the residual.
  const extraTaxFromAllowanceRestriction = shortfall > 0
    ? Math.min(shortfall, incomeTax(baseIncome, 0, gross) - taxAfter)
    : 0;
  const hicbcBefore = childBenefitCharge(baseIncome, benefit);
  const hicbcAfter = childBenefitCharge(newIncome, benefit);

  return {
    grossDonation: gross / 100,
    charityBasicRateReclaim: reclaim / 100,
    newAdjustedNetIncome: newIncome / 100,
    personalAllowanceBefore: allowanceBefore / 100,
    personalAllowanceAfter: allowanceAfter / 100,
    taxBefore: taxBefore / 100,
    taxAfter: taxAfter / 100,
    personalTaxRefund: refund / 100,
    trueNetCostToDonor: trueCost / 100,
    effectiveTaxReliefPct: gross > 0 ? 100 * (reclaim + refund) / gross : null,
    costPer100ToCharity: gross > 0 ? 100 * trueCost / gross : null,
    donationToRestoreAllowance: netDonationToReach(baseIncome, RULES.allowanceTaperStart),
    donationToReachHicbcThreshold: netDonationToReach(baseIncome, RULES.childBenefitThreshold),
    hicbcRateBefore: hicbcBefore.rate,
    hicbcRateAfter: hicbcAfter.rate,
    hicbcBefore: hicbcBefore.amount,
    hicbcAfter: hicbcAfter.amount,
    hicbcSavings: hicbcBefore.amount - hicbcAfter.amount,
    taxAvailableForGiftAid: taxAvailable / 100,
    hasEnoughTaxForGiftAid: shortfall === 0,
    giftAidTaxShortfall: shortfall / 100,
    extraTaxFromAllowanceRestriction: extraTaxFromAllowanceRestriction / 100,
    residualGiftAidTaxCharge: (shortfall - extraTaxFromAllowanceRestriction) / 100,
  };
}
