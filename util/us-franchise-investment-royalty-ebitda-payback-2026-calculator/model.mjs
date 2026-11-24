/**
 * Tool 489: 2026 US Franchise Investment, Royalty Fee & EBITDA Calculator
 * Pure deterministic ESM module.
 */

export const DEFAULT_FRANCHISE_FEE = 35000;
export const DEFAULT_BUILDOUT = 250000;
export const DEFAULT_EQUIPMENT = 120000;
export const DEFAULT_INVENTORY = 250000;
export const DEFAULT_WORKING_CAPITAL = 40000;

/**
 * Calculates monthly SBA 7(a) loan payment
 * @param {number} principal Loan principal
 * @param {number} annualRate Annual interest rate as percentage (e.g. 10.5 for 10.5%)
 * @param {number} termMonths Term length in months (typically 120 for 10-year term)
 */
export function calcMonthlyLoanPayment(principal, annualRate, termMonths = 120) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  const n = termMonths;
  return Math.round(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

/**
 * Calculates franchise unit economics, royalties, EBITDA, and payback metrics
 */
export function calcFranchiseEconomics(params) {
  const franchiseFee = Math.max(0, Number(params.franchiseFee ?? 35000));
  const buildoutCost = Math.max(0, Number(params.buildoutCost ?? 250000));
  const equipmentCost = Math.max(0, Number(params.equipmentCost ?? 120000));
  const inventoryCost = Math.max(0, Number(params.inventoryCost ?? 25000));
  const workingCapital = Math.max(0, Number(params.workingCapital ?? 40000));

  const totalInvestment = franchiseFee + buildoutCost + equipmentCost + inventoryCost + workingCapital;

  const cashEquityPercent = Math.min(100, Math.max(0, Number(params.cashEquityPercent ?? 25)));
  const cashInvested = Math.round(totalInvestment * (cashEquityPercent / 100));
  const sbaLoanAmount = totalInvestment - cashInvested;

  const sbaInterestRate = Math.max(0, Number(params.sbaInterestRate ?? 10.5));
  const loanTermMonths = Math.max(12, Number(params.loanTermMonths ?? 120));
  const monthlyDebtService = calcMonthlyLoanPayment(sbaLoanAmount, sbaInterestRate, loanTermMonths);
  const annualDebtService = monthlyDebtService * 12;

  const grossSales = Math.max(0, Number(params.grossSales ?? 950000));

  const cogsPercent = Math.max(0, Number(params.cogsPercent ?? 30));
  const laborPercent = Math.max(0, Number(params.laborPercent ?? 28));
  const rentAndOccupancy = Math.max(0, Number(params.rentAndOccupancy ?? 72000));
  const otherOpEx = Math.max(0, Number(params.otherOpEx ?? 34000)); // G&A, insurance, tech

  const royaltyPercent = Math.max(0, Number(params.royaltyPercent ?? 5.0));
  const adFundPercent = Math.max(0, Number(params.adFundPercent ?? 2.0));

  const cogsDollars = Math.round(grossSales * (cogsPercent / 100));
  const laborDollars = Math.round(grossSales * (laborPercent / 100));
  const royaltyDollars = Math.round(grossSales * (royaltyPercent / 100));
  const adFundDollars = Math.round(grossSales * (adFundPercent / 100));
  const totalFranchisorFees = royaltyDollars + adFundDollars;

  const totalOperatingExpenses = cogsDollars + laborDollars + rentAndOccupancy + otherOpEx + totalFranchisorFees;
  const storeEbitda = grossSales - totalOperatingExpenses;
  const ebitdaMarginPercent = grossSales > 0 ? (storeEbitda / grossSales) * 100 : 0;

  const annualFreeCashFlow = storeEbitda - annualDebtService;
  const dscr = annualDebtService > 0 ? storeEbitda / annualDebtService : 999;
  const cashOnCashRoi = cashInvested > 0 ? (annualFreeCashFlow / cashInvested) * 100 : 0;

  let monthsToPayback = 0;
  if (annualFreeCashFlow > 0) {
    monthsToPayback = Math.round((cashInvested / annualFreeCashFlow) * 12);
  } else {
    monthsToPayback = 999; // Negative cash flow
  }

  const royaltyAsPercentOfEbitda = storeEbitda > 0 ? (totalFranchisorFees / (storeEbitda + totalFranchisorFees)) * 100 : 100;

  return {
    totalInvestment,
    cashInvested,
    sbaLoanAmount,
    monthlyDebtService,
    annualDebtService,
    grossSales,
    cogsDollars,
    laborDollars,
    rentAndOccupancy,
    otherOpEx,
    royaltyDollars,
    adFundDollars,
    totalFranchisorFees,
    totalOperatingExpenses,
    storeEbitda,
    ebitdaMarginPercent: Math.round(ebitdaMarginPercent * 100) / 100,
    annualFreeCashFlow,
    dscr: Math.round(dscr * 100) / 100,
    cashOnCashRoi: Math.round(cashOnCashRoi * 100) / 100,
    monthsToPayback,
    royaltyAsPercentOfEbitda: Math.round(royaltyAsPercentOfEbitda * 10) / 10
  };
}
