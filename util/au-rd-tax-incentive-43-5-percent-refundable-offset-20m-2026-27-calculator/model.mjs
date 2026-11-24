/**
 * Tool 487: 2026-27 Australia ATO R&D Tax Incentive Calculator
 * Pure deterministic ESM module.
 */

export const TURNOVER_REFUNDABLE_THRESHOLD = 20000000; // $20M aggregated turnover cap for refundable offset
export const BASE_RATE_ENTITY_TAX_RATE = 0.25;         // 25.0% Base Rate Entity company tax rate
export const STANDARD_COMPANY_TAX_RATE = 0.30;         // 30.0% standard company tax rate
export const REFUNDABLE_PREMIUM = 0.185;               // 18.5% premium above company tax rate (25% + 18.5% = 43.5%)
export const TIER1_INTENSITY_PREMIUM = 0.085;          // 8.5% premium for R&D intensity <= 2.0%
export const TIER2_INTENSITY_PREMIUM = 0.165;          // 16.5% premium for R&D intensity > 2.0%
export const INTENSITY_SPLIT_THRESHOLD = 0.02;         // 2.0% R&D intensity threshold

/**
 * Calculates Full ATO R&D Tax Incentive
 */
export function calcAuRdTaxIncentive(params) {
  const eligibleRdSpend = Math.max(0, Number(params.eligibleRdSpend) || 0);
  const aggregatedTurnover = Math.max(0, Number(params.aggregatedTurnover) || 0);
  const totalBusinessExpenditure = Math.max(eligibleRdSpend, Number(params.totalBusinessExpenditure) || eligibleRdSpend);
  const isBaseRateEntity = params.isBaseRateEntity !== undefined ? Boolean(params.isBaseRateEntity) : true;
  const companyTaxRate = isBaseRateEntity ? BASE_RATE_ENTITY_TAX_RATE : STANDARD_COMPANY_TAX_RATE;
  const isTaxLoss = Boolean(params.isTaxLoss); // Company is in an overall tax loss position
  const companyTaxableIncome = Math.max(0, Number(params.companyTaxableIncome) || 0);

  // 1. Eligibility & Offset Category Determination
  const isRefundable = aggregatedTurnover < TURNOVER_REFUNDABLE_THRESHOLD;

  let grossRdOffset = 0;
  let effectiveOffsetRate = 0;
  let tier1Spend = 0;
  let tier2Spend = 0;
  let tier1Rate = 0;
  let tier2Rate = 0;
  let rdIntensity = 0;

  if (isRefundable) {
    // Category 1: Aggregated Turnover < $20M
    // Offset Rate = Company Tax Rate + 18.5% (43.5% for 25% tax rate, 48.5% for 30%)
    effectiveOffsetRate = companyTaxRate + REFUNDABLE_PREMIUM;
    grossRdOffset = Math.round(eligibleRdSpend * effectiveOffsetRate);
  } else {
    // Category 2: Aggregated Turnover >= $20M (Non-Refundable Intensity Tiers)
    rdIntensity = totalBusinessExpenditure > 0 ? (eligibleRdSpend / totalBusinessExpenditure) : 0;
    tier1Rate = companyTaxRate + TIER1_INTENSITY_PREMIUM; // e.g. 30% + 8.5% = 38.5%
    tier2Rate = companyTaxRate + TIER2_INTENSITY_PREMIUM; // e.g. 30% + 16.5% = 46.5%

    const intensityThresholdSpend = totalBusinessExpenditure * INTENSITY_SPLIT_THRESHOLD;

    if (eligibleRdSpend <= intensityThresholdSpend) {
      tier1Spend = eligibleRdSpend;
      tier2Spend = 0;
      grossRdOffset = Math.round(tier1Spend * tier1Rate);
    } else {
      tier1Spend = Math.round(intensityThresholdSpend);
      tier2Spend = Math.max(0, eligibleRdSpend - tier1Spend);
      grossRdOffset = Math.round(tier1Spend * tier1Rate + tier2Spend * tier2Rate);
    }
    effectiveOffsetRate = eligibleRdSpend > 0 ? (grossRdOffset / eligibleRdSpend) : 0;
  }

  // 2. Value Comparison vs Standard 100% Tax Deduction
  // Under standard taxation, R&D is deductible at companyTaxRate
  const standardDeductionValue = Math.round(eligibleRdSpend * companyTaxRate);
  const netIncrementalBenefit = Math.max(0, grossRdOffset - standardDeductionValue);
  const netIncrementalRate = effectiveOffsetRate - companyTaxRate;

  // 3. Tax Refund vs Offset Against Tax Payable
  let taxPayableBeforeRd = Math.round(companyTaxableIncome * companyTaxRate);
  let taxPayableAfterRd = 0;
  let cashRefundAmount = 0;

  if (isRefundable) {
    if (isTaxLoss) {
      // In a pure tax loss year, the entire gross offset is paid in cash by the ATO!
      cashRefundAmount = grossRdOffset;
      taxPayableAfterRd = 0;
    } else {
      // First offsets tax payable, remainder is paid in cash
      if (grossRdOffset >= taxPayableBeforeRd) {
        cashRefundAmount = grossRdOffset - taxPayableBeforeRd;
        taxPayableAfterRd = 0;
      } else {
        cashRefundAmount = 0;
        taxPayableAfterRd = taxPayableBeforeRd - grossRdOffset;
      }
    }
  } else {
    // Non-refundable: reduces tax to zero, excess carries forward (no cash refund)
    taxPayableAfterRd = Math.max(0, taxPayableBeforeRd - grossRdOffset);
    cashRefundAmount = 0;
  }

  return {
    eligibleRdSpend,
    aggregatedTurnover,
    totalBusinessExpenditure,
    isBaseRateEntity,
    companyTaxRate,
    isRefundable,
    isTaxLoss,
    effectiveOffsetRate: Math.round(effectiveOffsetRate * 1000) / 10,
    grossRdOffset,
    standardDeductionValue,
    netIncrementalBenefit,
    netIncrementalRate: Math.round(netIncrementalRate * 1000) / 10,
    rdIntensity: Math.round(rdIntensity * 1000) / 10,
    tier1Spend,
    tier2Spend,
    tier1Rate: Math.round(tier1Rate * 1000) / 10,
    tier2Rate: Math.round(tier2Rate * 1000) / 10,
    taxPayableBeforeRd,
    taxPayableAfterRd,
    cashRefundAmount
  };
}
