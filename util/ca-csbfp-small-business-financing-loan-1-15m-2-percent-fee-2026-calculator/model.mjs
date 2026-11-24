/**
 * Tool 488: 2026 Canada Small Business Financing Program (CSBFP) Calculator
 * Pure deterministic ESM module.
 */

export const CSBFP_MAX_OVERALL = 1150000;         // $1,150,000 max overall loan facility
export const CSBFP_MAX_REAL_PROPERTY = 1000000;   // $1,000,000 max for real property term loan
export const CSBFP_MAX_EQUIPMENT_LEASEHOLD = 500000; // $500,000 max for equipment & leasehold improvements
export const CSBFP_MAX_WORKING_CAPITAL = 150000;  // $150,000 max for working capital & intangible assets
export const CSBFP_REGISTRATION_FEE_RATE = 0.02;  // 2.0% one-time government registration fee

/**
 * Calculates monthly P&I payment
 */
export function calcMonthlyPi(principal, annualRate, termYears) {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  const n = Math.max(1, termYears * 12);
  const pmt = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(pmt);
}

/**
 * Full CSBFP Loan Structure and Statutory Compliance
 */
export function calcCanadaCsbfpLoan(params) {
  const realPropertyAmount = Math.max(0, Number(params.realPropertyAmount) || 0);
  const equipmentLeaseholdAmount = Math.max(0, Number(params.equipmentLeaseholdAmount) || 0);
  const workingCapitalAmount = Math.max(0, Number(params.workingCapitalAmount) || 0);
  const feeFinanced = params.feeFinanced !== undefined ? Boolean(params.feeFinanced) : true;

  const primeRate = Math.max(0.01, Number(params.primeRate) || 0.0545); // e.g. 5.45% Bank of Canada prime
  const lenderSpread = Math.min(0.03, Math.max(0, Number(params.lenderSpread) || 0.03)); // Max Prime + 3.0%
  const annualInterestRate = primeRate + lenderSpread;

  const termYearsRealProperty = Math.min(15, Math.max(1, Number(params.termYearsRealProperty) || 15)); // Up to 15 yrs
  const termYearsOther = Math.min(10, Math.max(1, Number(params.termYearsOther) || 10)); // Up to 10 yrs

  // 1. Statutory Cap Compliance Check
  const isRealPropertyCompliant = realPropertyAmount <= CSBFP_MAX_REAL_PROPERTY;
  const isEquipmentCompliant = equipmentLeaseholdAmount <= CSBFP_MAX_EQUIPMENT_LEASEHOLD;
  const isWorkingCapitalCompliant = workingCapitalAmount <= CSBFP_MAX_WORKING_CAPITAL;

  const totalTermLoans = realPropertyAmount + equipmentLeaseholdAmount;
  const totalRequested = realPropertyAmount + equipmentLeaseholdAmount + workingCapitalAmount;
  const isOverallCompliant = totalRequested <= CSBFP_MAX_OVERALL && (realPropertyAmount <= CSBFP_MAX_REAL_PROPERTY);
  const isFullyCompliant = isRealPropertyCompliant && isEquipmentCompliant && isWorkingCapitalCompliant && isOverallCompliant && totalRequested > 0;

  // 2. 2.0% Government Registration Fee
  const registrationFee = Math.round(totalRequested * CSBFP_REGISTRATION_FEE_RATE);

  // 3. Financed Principal Breakdown
  // If financed, fee is allocated proportionally or added to total loan
  const totalLoanFinanced = feeFinanced ? (totalRequested + registrationFee) : totalRequested;

  // Monthly Debt Service:
  // Split between Real Property (up to 15 yrs) and Equipment/Working Capital (up to 10 yrs)
  const feeAllocatedReal = feeFinanced && totalRequested > 0 ? Math.round(registrationFee * (realPropertyAmount / totalRequested)) : 0;
  const feeAllocatedOther = feeFinanced && totalRequested > 0 ? (registrationFee - feeAllocatedReal) : 0;

  const financedRealProperty = realPropertyAmount + feeAllocatedReal;
  const financedOther = equipmentLeaseholdAmount + workingCapitalAmount + feeAllocatedOther;

  const monthlyPaymentReal = calcMonthlyPi(financedRealProperty, annualInterestRate, termYearsRealProperty);
  const monthlyPaymentOther = calcMonthlyPi(financedOther, annualInterestRate, termYearsOther);
  const combinedMonthlyPayment = monthlyPaymentReal + monthlyPaymentOther;

  const totalPayments = (monthlyPaymentReal * termYearsRealProperty * 12) + (monthlyPaymentOther * termYearsOther * 12);
  const totalInterest = Math.max(0, totalPayments - totalLoanFinanced);
  const totalCostOfBorrowing = totalInterest + registrationFee;

  return {
    realPropertyAmount,
    equipmentLeaseholdAmount,
    workingCapitalAmount,
    totalRequested,
    totalTermLoans,
    feeFinanced,
    primeRate: Math.round(primeRate * 10000) / 100,
    lenderSpread: Math.round(lenderSpread * 10000) / 100,
    annualInterestRate: Math.round(annualInterestRate * 10000) / 100,
    isRealPropertyCompliant,
    isEquipmentCompliant,
    isWorkingCapitalCompliant,
    isOverallCompliant,
    isFullyCompliant,
    registrationFee,
    totalLoanFinanced,
    financedRealProperty,
    financedOther,
    monthlyPaymentReal,
    monthlyPaymentOther,
    combinedMonthlyPayment,
    totalPayments,
    totalInterest,
    totalCostOfBorrowing
  };
}
