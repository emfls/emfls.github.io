/**
 * Tool 490: 2026/27 UK Invoice Factoring vs Confidential Invoice Discounting Calculator
 * Pure deterministic ESM module.
 */

export const DEFAULT_TURNOVER = 2000000;
export const DEFAULT_DEBTOR_DAYS = 45;
export const DEFAULT_ADVANCE_RATE = 85;
export const DEFAULT_BOE_BASE_RATE = 4.75; // 2026 Bank of England Base Rate benchmark

/**
 * Calculates average outstanding sales ledger balance
 * @param {number} annualTurnover Annual credit turnover (£)
 * @param {number} debtorDays Days sales outstanding (DSO)
 */
export function calcOutstandingLedger(annualTurnover, debtorDays) {
  if (annualTurnover <= 0 || debtorDays <= 0) return 0;
  return Math.round((annualTurnover * debtorDays) / 365);
}

/**
 * Calculates average funds in use (borrowed balance)
 * @param {number} ledgerBalance Outstanding sales ledger
 * @param {number} advancePercent Advance rate percentage (typically 80% to 90%)
 */
export function calcFundsInUse(ledgerBalance, advancePercent = 85) {
  if (ledgerBalance <= 0 || advancePercent <= 0) return 0;
  return Math.round(ledgerBalance * (advancePercent / 100));
}

/**
 * Complete UK Invoice Finance comparative analysis
 */
export function calcInvoiceFinance(params) {
  const turnover = Math.max(0, Number(params.annualTurnover ?? 2000000));
  const debtorDays = Math.max(1, Math.min(180, Number(params.debtorDays ?? 45)));
  const advancePercent = Math.max(50, Math.min(95, Number(params.advancePercent ?? 85)));

  const outstandingLedger = calcOutstandingLedger(turnover, debtorDays);
  const fundsInUse = calcFundsInUse(outstandingLedger, advancePercent);

  // Bank of England Base Rate
  const boeBaseRate = Math.max(0, Number(params.boeBaseRate ?? 4.75));

  // Option 1: Full Service Factoring
  const factoringServiceRate = Math.max(0, Number(params.factoringServiceRate ?? 1.50)); // % of turnover
  const factoringMargin = Math.max(0, Number(params.factoringMargin ?? 2.75));           // % over base rate
  const factoringTotalDiscountRate = boeBaseRate + factoringMargin;

  const factoringAnnualServiceFee = Math.round(turnover * (factoringServiceRate / 100));
  const factoringAnnualDiscountFee = Math.round(fundsInUse * (factoringTotalDiscountRate / 100));
  const factoringTotalCost = factoringAnnualServiceFee + factoringAnnualDiscountFee;
  const factoringTrueApr = fundsInUse > 0 ? (factoringTotalCost / fundsInUse) * 100 : 0;

  // Option 2: Confidential Invoice Discounting (CID)
  const cidServiceRate = Math.max(0, Number(params.cidServiceRate ?? 0.40)); // % of turnover
  const cidMargin = Math.max(0, Number(params.cidMargin ?? 2.25));           // % over base rate
  const cidTotalDiscountRate = boeBaseRate + cidMargin;

  const cidAnnualServiceFee = Math.round(turnover * (cidServiceRate / 100));
  const cidAnnualDiscountFee = Math.round(fundsInUse * (cidTotalDiscountRate / 100));
  const cidTotalCost = cidAnnualServiceFee + cidAnnualDiscountFee;
  const cidTrueApr = fundsInUse > 0 ? (cidTotalCost / fundsInUse) * 100 : 0;

  // Option 3: Traditional Bank Overdraft (Benchmark)
  const overdraftApr = Math.max(0, Number(params.overdraftApr ?? 9.75));
  const overdraftTotalCost = Math.round(fundsInUse * (overdraftApr / 100));

  // Savings & Comparisons
  const annualSavingsCidVsFactoring = factoringTotalCost - cidTotalCost;
  const monthlyCashReleased = fundsInUse;

  return {
    turnover,
    debtorDays,
    advancePercent,
    outstandingLedger,
    fundsInUse,
    boeBaseRate,
    factoring: {
      serviceRate: factoringServiceRate,
      margin: factoringMargin,
      totalDiscountRate: Math.round(factoringTotalDiscountRate * 100) / 100,
      annualServiceFee: factoringAnnualServiceFee,
      annualDiscountFee: factoringAnnualDiscountFee,
      totalCost: factoringTotalCost,
      trueApr: Math.round(factoringTrueApr * 100) / 100
    },
    cid: {
      serviceRate: cidServiceRate,
      margin: cidMargin,
      totalDiscountRate: Math.round(cidTotalDiscountRate * 100) / 100,
      annualServiceFee: cidAnnualServiceFee,
      annualDiscountFee: cidAnnualDiscountFee,
      totalCost: cidTotalCost,
      trueApr: Math.round(cidTrueApr * 100) / 100
    },
    overdraft: {
      apr: overdraftApr,
      totalCost: overdraftTotalCost
    },
    annualSavingsCidVsFactoring,
    monthlyCashReleased
  };
}
