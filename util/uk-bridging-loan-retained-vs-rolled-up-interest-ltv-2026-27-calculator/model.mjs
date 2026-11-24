// 2026/27 UK Short-Term Commercial & Bridging Finance Mathematical Models
export const DEFAULT_MAX_BRIDGING_LTV = 75; // 75% maximum standard gross LTV ceiling
export const DEFAULT_ARRANGEMENT_FEE_PCT = 2.0; // 2.0% standard facility arrangement fee

export function calcUkBridgingLoan(inputs = {}) {
  const {
    propertyValue = 500000,
    grossLoan = 350000,
    monthlyRate = 0.85, // % per month
    termMonths = 12,
    arrangementFeePercent = DEFAULT_ARRANGEMENT_FEE_PCT,
    otherFees = 2500, // legal + valuation + broker admin
    exitFeePercent = 0.0,
    maxLtvPercent = DEFAULT_MAX_BRIDGING_LTV
  } = inputs;

  const validPropVal = Math.max(10000, Number(propertyValue) || 0);
  const validGross = Math.max(0, Number(grossLoan) || 0);
  const validRate = Math.max(0.1, Number(monthlyRate) || 0.85) / 100;
  const validTerm = Math.max(1, Math.min(36, parseInt(termMonths, 10) || 12));
  const validArrFeePct = Math.max(0, Math.min(5, Number(arrangementFeePercent) || 0)) / 100;
  const validOtherFees = Math.max(0, Number(otherFees) || 0);
  const validExitFeePct = Math.max(0, Math.min(5, Number(exitFeePercent) || 0)) / 100;
  const validMaxLtv = Math.max(50, Math.min(85, Number(maxLtvPercent) || 75)) / 100;

  // LTV Constraints
  const ltvCapAmount = validPropVal * validMaxLtv;
  const grossLtv = validPropVal > 0 ? (validGross / validPropVal) * 100 : 0;
  const isOverLtvCap = validGross > ltvCapAmount;

  // Facility fees
  const arrangementFee = validGross * validArrFeePct;
  const exitFee = validGross * validExitFeePct;
  const totalFacilityFees = arrangementFee + validOtherFees + exitFee;

  // 1. RETAINED INTEREST MODEL
  // Interest is deducted upfront from the gross advance. Borrower has no monthly payments.
  const retainedInterestTotal = validGross * validRate * validTerm;
  const retainedNetAdvanceDay1 = Math.max(0, validGross - retainedInterestTotal - arrangementFee - validOtherFees);
  const retainedRedemption = validGross + exitFee;
  const retainedTotalCost = retainedInterestTotal + totalFacilityFees;
  const retainedNetLtv = validPropVal > 0 ? (retainedNetAdvanceDay1 / validPropVal) * 100 : 0;
  // Early redemption rebate (e.g. Month 6 of 12)
  const rebateMonths = Math.max(0, Math.floor(validTerm / 2));
  const earlyRedemptionRebate = validGross * validRate * rebateMonths;

  // 2. ROLLED-UP INTEREST MODEL (Compounded Monthly)
  // Interest accrues to the loan balance. Full gross advance (minus fees) is paid Day 1.
  const rolledNetAdvanceDay1 = Math.max(0, validGross - arrangementFee - validOtherFees);
  const rolledCompoundInterest = validGross * (Math.pow(1 + validRate, validTerm) - 1);
  const rolledRedemption = validGross + rolledCompoundInterest + exitFee;
  const rolledTotalCost = rolledCompoundInterest + totalFacilityFees;
  const rolledFinalLtv = validPropVal > 0 ? (rolledRedemption / validPropVal) * 100 : 0;
  const rolledFinalBreachesLtv = rolledRedemption > ltvCapAmount;

  // Comparison metrics
  const day1AdvanceAdvantage = rolledNetAdvanceDay1 - retainedNetAdvanceDay1;
  const totalCostDifference = rolledTotalCost - retainedTotalCost;

  return {
    propertyValue: validPropVal,
    grossLoan: validGross,
    monthlyRatePercent: Math.round(validRate * 10000) / 100,
    annualRateEquivalent: Math.round(validRate * 12 * 10000) / 100,
    termMonths: validTerm,
    ltvCapAmount: Math.round(ltvCapAmount * 100) / 100,
    grossLtv: Math.round(grossLtv * 100) / 100,
    isOverLtvCap,
    arrangementFee: Math.round(arrangementFee * 100) / 100,
    exitFee: Math.round(exitFee * 100) / 100,
    otherFees: validOtherFees,
    totalFacilityFees: Math.round(totalFacilityFees * 100) / 100,
    retained: {
      interestTotal: Math.round(retainedInterestTotal * 100) / 100,
      netAdvanceDay1: Math.round(retainedNetAdvanceDay1 * 100) / 100,
      redemption: Math.round(retainedRedemption * 100) / 100,
      totalCost: Math.round(retainedTotalCost * 100) / 100,
      netLtv: Math.round(retainedNetLtv * 100) / 100,
      earlyRedemptionRebate: Math.round(earlyRedemptionRebate * 100) / 100
    },
    rolledUp: {
      interestTotal: Math.round(rolledCompoundInterest * 100) / 100,
      netAdvanceDay1: Math.round(rolledNetAdvanceDay1 * 100) / 100,
      redemption: Math.round(rolledRedemption * 100) / 100,
      totalCost: Math.round(rolledTotalCost * 100) / 100,
      finalLtv: Math.round(rolledFinalLtv * 100) / 100,
      breachesLtv: rolledFinalBreachesLtv
    },
    comparison: {
      day1AdvanceAdvantage: Math.round(day1AdvanceAdvantage * 100) / 100,
      totalCostDifference: Math.round(totalCostDifference * 100) / 100
    }
  };
}
