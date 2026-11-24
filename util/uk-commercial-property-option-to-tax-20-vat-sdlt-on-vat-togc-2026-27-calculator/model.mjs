/**
 * Tool 498: 2026/27 UK Commercial Property Option to Tax & SDLT Calculator
 * Pure deterministic ESM module.
 */

export const COMMERCIAL_SDLT_BANDS = [
  { threshold: 150000, rate: 0.00 },
  { threshold: 250000, rate: 0.02 },
  { threshold: Infinity, rate: 0.05 }
];

export function calcCommercialSdlt(consideration) {
  if (consideration <= 150000) return 0;
  let tax = 0;
  if (consideration > 150000) {
    const band2Amount = Math.min(consideration, 250000) - 150000;
    tax += band2Amount * 0.02;
  }
  if (consideration > 250000) {
    const band3Amount = consideration - 250000;
    tax += band3Amount * 0.05;
  }
  return Math.round(tax);
}

export function calcOptionToTaxEconomics(params) {
  const netPrice = Math.max(0, Number(params.netPrice ?? 1000000));
  const vatRate = Math.max(0, Number(params.vatRate ?? 20)) / 100;
  const bridgingMonths = Math.max(0, Number(params.bridgingMonths ?? 3));
  const bridgingAnnualRate = Math.max(0, Number(params.bridgingAnnualRate ?? 8.5)) / 100;
  const isOptionToTax = Boolean(params.isOptionToTax ?? true);
  const isTogcEligible = Boolean(params.isTogcEligible ?? false);

  const vatAmount = isOptionToTax ? Math.round(netPrice * vatRate) : 0;
  const grossPrice = netPrice + vatAmount;

  const baseSdltOnNet = calcCommercialSdlt(netPrice);
  const sdltOnGross = isOptionToTax ? calcCommercialSdlt(grossPrice) : baseSdltOnNet;

  // The extra SDLT caused by VAT being included in consideration
  const irrecoverableSdltOnVat = Math.max(0, sdltOnGross - baseSdltOnNet);

  // Cash flow bridging cost of the VAT while waiting for HMRC reclaim
  const vatBridgingCost = Math.round(vatAmount * bridgingAnnualRate * (bridgingMonths / 12));

  // Total cash required at completion under Option to Tax
  const completionCashRequiredOtt = grossPrice + sdltOnGross;

  // Total cash required at completion under TOGC (no VAT, base SDLT only)
  const completionCashRequiredTogc = netPrice + baseSdltOnNet;

  // Total upfront cash savings with TOGC
  const upfrontCashSavedTogc = completionCashRequiredOtt - completionCashRequiredTogc;

  // Permanent economic loss if opted to tax vs TOGC (SDLT-on-VAT + Bridging finance)
  const permanentEconomicLoss = irrecoverableSdltOnVat + vatBridgingCost;

  return {
    netPrice,
    vatAmount,
    grossPrice,
    baseSdltOnNet,
    sdltOnGross,
    irrecoverableSdltOnVat,
    vatBridgingCost,
    completionCashRequiredOtt,
    completionCashRequiredTogc,
    upfrontCashSavedTogc,
    permanentEconomicLoss,
    effectiveSdltRateNet: netPrice > 0 ? (sdltOnGross / netPrice) * 100 : 0
  };
}
