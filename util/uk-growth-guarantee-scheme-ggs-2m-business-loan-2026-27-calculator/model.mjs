/**
 * Tool 486: 2026-27 UK Growth Guarantee Scheme (GGS) Business Loan Calculator
 * Pure deterministic ESM module.
 */

export const GGS_MAX_FACILITY_STANDARD = 2000000; // £2,000,000 per business group
export const GGS_MAX_FACILITY_NI = 1000000;       // £1,000,000 under Northern Ireland Protocol
export const GGS_MAX_TURNOVER = 45000000;         // £45M max annual turnover eligibility
export const GGS_GOVERNMENT_GUARANTEE = 0.70;     // 70% guarantee to accredited lender
export const GGS_MAX_TERM_LOAN_YEARS = 6;         // 6 years (72 months) max for term loans
export const GGS_MAX_REVOLVING_YEARS = 3;         // 3 years (36 months) max for overdraft/invoice finance

/**
 * Calculates monthly repayment for commercial loan
 */
export function calcMonthlyRepayment(principal, annualRate, termMonths) {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  const n = Math.max(1, termMonths);
  const pmt = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(pmt);
}

/**
 * Full UK GGS Loan Calculation
 */
export function calcUkGgsLoan(params) {
  const facilityAmount = Math.max(0, Number(params.facilityAmount) || 0);
  const annualTurnover = Math.max(0, Number(params.annualTurnover) || 0);
  const isNorthernIreland = Boolean(params.isNorthernIreland);
  const facilityType = params.facilityType === 'revolving' ? 'revolving' : 'term_loan';
  const interestRate = Math.max(0.01, Number(params.interestRate) || 0.0825); // e.g. 8.25%
  const termMonths = Math.min(
    facilityType === 'revolving' ? GGS_MAX_REVOLVING_YEARS * 12 : GGS_MAX_TERM_LOAN_YEARS * 12,
    Math.max(6, Number(params.termMonths) || 60)
  );
  const arrangementFeeRate = Math.min(0.10, Math.max(0, Number(params.arrangementFeeRate) || 0.02)); // 2.0% standard
  const annualEbitda = Math.max(0, Number(params.annualEbitda) || 0);
  const existingAnnualDebt = Math.max(0, Number(params.existingAnnualDebt) || 0);

  // 1. Eligibility Checks
  const maxFacilityAllowed = isNorthernIreland ? GGS_MAX_FACILITY_NI : GGS_MAX_FACILITY_STANDARD;
  const isTurnoverEligible = annualTurnover <= GGS_MAX_TURNOVER;
  const isFacilityWithinCap = facilityAmount <= maxFacilityAllowed;
  const isEligible = isTurnoverEligible && isFacilityWithinCap && facilityAmount > 0;

  // 2. Fees & Loan Principal
  const arrangementFee = Math.round(facilityAmount * arrangementFeeRate);
  const lenderGuaranteedPortion = Math.round(facilityAmount * GGS_GOVERNMENT_GUARANTEE);
  const borrowerLiability = facilityAmount; // 100% borrower liability!

  // 3. Repayments
  const monthlyRepayment = calcMonthlyRepayment(facilityAmount, interestRate, termMonths);
  const totalRepayments = monthlyRepayment * termMonths;
  const totalInterest = Math.max(0, totalRepayments - facilityAmount);
  const totalCostOfFinance = totalInterest + arrangementFee;

  // 4. Annual Debt Service & EBITDA DSCR
  const newAnnualDebtService = monthlyRepayment * 12;
  const totalAnnualDebtService = newAnnualDebtService + existingAnnualDebt;
  const dscr = totalAnnualDebtService > 0 ? Math.round((annualEbitda / totalAnnualDebtService) * 100) / 100 : (annualEbitda > 0 ? 99 : 0);
  const passesDscr = dscr >= 1.25; // 1.25x typical lender stress threshold

  return {
    facilityAmount,
    annualTurnover,
    isNorthernIreland,
    facilityType,
    interestRate,
    termMonths,
    arrangementFeeRate,
    arrangementFee,
    maxFacilityAllowed,
    isTurnoverEligible,
    isFacilityWithinCap,
    isEligible,
    lenderGuaranteedPortion,
    borrowerLiability,
    monthlyRepayment,
    totalRepayments,
    totalInterest,
    totalCostOfFinance,
    annualEbitda,
    existingAnnualDebt,
    newAnnualDebtService,
    totalAnnualDebtService,
    dscr,
    passesDscr
  };
}
