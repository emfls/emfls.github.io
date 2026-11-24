/**
 * Tool 492: 2026 Canada Small Business Valuation & Exit Tax Calculator
 * Pure deterministic ESM module.
 */

export const LCGE_2026_LIMIT = 1275000; // 2026 indexed Lifetime Capital Gains Exemption for QSBC shares
export const DEFAULT_PROVINCIAL_TOP_RATE = 53.53; // Ontario top marginal personal tax rate
export const DEFAULT_CORP_TAX_RATE = 26.50; // Canadian standard general corporate rate on asset sales
export const DEFAULT_DIVIDEND_TAX_RATE = 40.00; // Blended dividend extraction tax rate on retained corporate profits

/**
 * Calculates Seller's Discretionary Earnings (SDE)
 */
export function calcSde(netIncome, ownerComp, depAmort, interestExp, discretionary) {
  return Math.max(0, netIncome + ownerComp + depAmort + interestExp + discretionary);
}

/**
 * Calculates complete business valuation and exit proceeds comparing Share Sale vs Asset Sale
 */
export function calcCanadaBusinessExit(params) {
  const method = String(params.method ?? 'sde').toLowerCase();

  // Valuation inputs
  const netIncome = Math.max(0, Number(params.netIncome ?? 280000));
  const ownerComp = Math.max(0, Number(params.ownerComp ?? 120000));
  const depAmort = Math.max(0, Number(params.depAmort ?? 35000));
  const interestExp = Math.max(0, Number(params.interestExp ?? 15000));
  const discretionary = Math.max(0, Number(params.discretionary ?? 20000));

  let earningsBase = 0;
  let multiple = 3.0;

  if (method === 'ebitda') {
    earningsBase = Math.max(0, Number(params.adjustedEbitda ?? 450000));
    multiple = Math.max(1.0, Math.min(15.0, Number(params.ebitdaMultiple ?? 4.5)));
  } else {
    earningsBase = calcSde(netIncome, ownerComp, depAmort, interestExp, discretionary);
    multiple = Math.max(1.0, Math.min(10.0, Number(params.sdeMultiple ?? 3.0)));
  }

  const enterpriseValue = Math.round(earningsBase * multiple);

  // Closing deductions
  const brokerFeePercent = Math.max(0, Math.min(15, Number(params.brokerFeePercent ?? 7.0)));
  const brokerFee = Math.round(enterpriseValue * (brokerFeePercent / 100));
  const legalAccountingCosts = Math.max(0, Number(params.legalAccountingCosts ?? 30000));
  const businessDebtPayoff = Math.max(0, Number(params.businessDebtPayoff ?? 150000));

  const totalDeductions = brokerFee + legalAccountingCosts + businessDebtPayoff;
  const netSellingPrice = Math.max(0, enterpriseValue - totalDeductions);

  // Structure A: Share Sale with 2026 LCGE ($1,275,000)
  const acbOfShares = Math.max(0, Number(params.acbOfShares ?? 10000));
  const availableLcge = Math.min(LCGE_2026_LIMIT, Math.max(0, Number(params.availableLcge ?? LCGE_2026_LIMIT)));
  const personalTopRate = Math.max(0, Number(params.personalTopRate ?? DEFAULT_PROVINCIAL_TOP_RATE)) / 100;

  const totalShareGain = Math.max(0, netSellingPrice - acbOfShares);
  const exemptShareGain = Math.min(totalShareGain, availableLcge);
  const excessShareGain = Math.max(0, totalShareGain - exemptShareGain);

  // 2026 Canadian Capital Gains Rule: 50% on first $250k above LCGE, 66.67% on remainder
  let taxableCapitalGain = 0;
  if (excessShareGain > 0) {
    const tier1 = Math.min(excessShareGain, 250000);
    const tier2 = Math.max(0, excessShareGain - 250000);
    taxableCapitalGain = (tier1 * 0.50) + (tier2 * (2 / 3));
  }

  const personalShareTax = Math.round(taxableCapitalGain * personalTopRate);
  const netShareSaleCashInPocket = netSellingPrice - personalShareTax;

  // Structure B: Asset Sale (Corporate Tax + Personal Dividend Extraction)
  const corpTaxRate = Math.max(0, Number(params.corpTaxRate ?? DEFAULT_CORP_TAX_RATE)) / 100;
  const dividendTaxRate = Math.max(0, Number(params.dividendTaxRate ?? DEFAULT_DIVIDEND_TAX_RATE)) / 100;

  // Asset sale assumption: 85% goodwill (capital gain in corporation), 15% equipment recapture
  const corporateTaxableIncome = netSellingPrice;
  // Corporate tax on asset sale: ~25% effective corporate tax
  const corporateTax = Math.round(corporateTaxableIncome * corpTaxRate);
  const afterTaxCorporateCash = Math.max(0, netSellingPrice - corporateTax);

  // Personal extraction: 50% of capital gain flows through tax-free Capital Dividend Account (CDA)
  // Remaining 50% is taxed as personal taxable dividend
  const cdaTaxFreeDividend = Math.round(afterTaxCorporateCash * 0.45);
  const taxableDividendPortion = afterTaxCorporateCash - cdaTaxFreeDividend;
  const personalDividendTax = Math.round(taxableDividendPortion * dividendTaxRate);

  const totalAssetSaleTaxes = corporateTax + personalDividendTax;
  const netAssetSaleCashInPocket = netSellingPrice - totalAssetSaleTaxes;

  // Final comparison metrics
  const shareSaleCashAdvantage = netShareSaleCashInPocket - netAssetSaleCashInPocket;
  const effectiveShareTaxRate = totalShareGain > 0 ? (personalShareTax / totalShareGain) * 100 : 0;
  const effectiveAssetTaxRate = netSellingPrice > 0 ? (totalAssetSaleTaxes / netSellingPrice) * 100 : 0;

  return {
    method,
    earningsBase,
    multiple,
    enterpriseValue,
    brokerFee,
    legalAccountingCosts,
    businessDebtPayoff,
    totalDeductions,
    netSellingPrice,
    shareSale: {
      acbOfShares,
      availableLcge,
      totalShareGain,
      exemptShareGain,
      excessShareGain,
      personalShareTax,
      netCashInPocket: netShareSaleCashInPocket,
      effectiveTaxRate: Math.round(effectiveShareTaxRate * 10) / 10
    },
    assetSale: {
      corporateTax,
      cdaTaxFreeDividend,
      personalDividendTax,
      totalTaxes: totalAssetSaleTaxes,
      netCashInPocket: netAssetSaleCashInPocket,
      effectiveTaxRate: Math.round(effectiveAssetTaxRate * 10) / 10
    },
    shareSaleCashAdvantage: Math.max(0, shareSaleCashAdvantage),
    advantagePercentOfValue: enterpriseValue > 0 ? Math.round((shareSaleCashAdvantage / enterpriseValue) * 1000) / 10 : 0
  };
}
