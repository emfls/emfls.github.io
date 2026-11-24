// 2026/27 UK PRA SS13/16 Buy-to-Let Mortgage Underwriting Standards & Interest Coverage Ratio (ICR) Formulas
export const PRA_MINIMUM_STRESS_RATE = 0.055; // 5.50% minimum stress rate for < 5yr fixes
export const PRA_STRESS_RATE_MARGIN = 0.02;   // Pay rate + 2.0%
export const ICR_SPV_LTD_CO = 1.25;           // 125% ICR for SPV Limited Companies & Basic Rate (20%) Taxpayers
export const ICR_PERSONAL_HIGHER_RATE = 1.45; // 145% ICR for Higher Rate (40%) & Additional Rate (45%) Taxpayers (Section 24)
export const DEFAULT_MAX_LTV = 0.75;          // 75% standard maximum LTV cap

export function calcBtlIcrStressTest(inputs = {}) {
  const {
    propertyValue = 350000,
    monthlyRent = 1650,
    payRate = 4.85, // % mortgage interest pay rate
    mortgageTermType = "5yr_fixed", // '5yr_fixed' (pay rate relief) or '2yr_fixed_variable' (pay rate + 2% min 5.5%)
    borrowerStructure = "spv_ltd_co", // 'spv_ltd_co' (125%) or 'personal_higher' (145%)
    targetLtvPercent = 75,
    maxLtvCapPercent = 75
  } = inputs;

  const validPropValue = Math.max(0, Number(propertyValue) || 0);
  const validRent = Math.max(0, Number(monthlyRent) || 0);
  const annualRent = validRent * 12;
  const validPayRate = Math.max(0.5, Number(payRate) || 4.85) / 100;
  const validTargetLtv = Math.max(10, Math.min(90, Number(targetLtvPercent) || 75)) / 100;
  const validMaxLtvCap = Math.max(10, Math.min(90, Number(maxLtvCapPercent) || 75)) / 100;

  // 1. Stress Rate Determination under PRA SS13/16
  let effectiveStressRate = validPayRate;
  if (mortgageTermType === "2yr_fixed_variable") {
    effectiveStressRate = Math.max(PRA_MINIMUM_STRESS_RATE, validPayRate + PRA_STRESS_RATE_MARGIN);
  }

  // 2. ICR Multiplier
  const icrMultiplier = (borrowerStructure === "spv_ltd_co") ? ICR_SPV_LTD_CO : ICR_PERSONAL_HIGHER_RATE;

  // 3. Maximum Loan Calculation via ICR Formula: Max Loan = Annual Rent / (Stress Rate * ICR)
  const icrDenominator = effectiveStressRate * icrMultiplier;
  const rawIcrMaxLoan = icrDenominator > 0 ? (annualRent / icrDenominator) : 0;

  // 4. Physical LTV Cap Ceiling
  const ltvCeilingLoan = validPropValue * validMaxLtvCap;
  const targetLoanRequested = validPropValue * validTargetLtv;

  // The actual maximum lending is capped by the lower of ICR capacity and physical LTV ceiling
  const actualMaxLoan = Math.min(rawIcrMaxLoan, ltvCeilingLoan);
  const isConstrainedByIcr = rawIcrMaxLoan < ltvCeilingLoan;
  const isConstrainedByLtv = ltvCeilingLoan <= rawIcrMaxLoan;

  // 5. Pass / Fail Assessment
  const passesStressTest = actualMaxLoan >= targetLoanRequested;
  const loanShortfall = Math.max(0, targetLoanRequested - actualMaxLoan);
  const extraDepositNeeded = loanShortfall;

  // 6. Minimum Monthly Rent Required to clear Target Loan under this stress rate
  const minRequiredMonthlyRent = (targetLoanRequested * icrDenominator) / 12;

  // 7. SPV Limited Company vs Personal Higher-Rate Comparison
  const spvIcrMaxLoan = icrDenominator > 0 ? (annualRent / (effectiveStressRate * ICR_SPV_LTD_CO)) : 0;
  const personalIcrMaxLoan = icrDenominator > 0 ? (annualRent / (effectiveStressRate * ICR_PERSONAL_HIGHER_RATE)) : 0;
  const spvEffectiveLoan = Math.min(spvIcrMaxLoan, ltvCeilingLoan);
  const personalEffectiveLoan = Math.min(personalIcrMaxLoan, ltvCeilingLoan);
  const spvBorrowingAdvantage = Math.max(0, spvEffectiveLoan - personalEffectiveLoan);

  return {
    propertyValue: validPropValue,
    monthlyRent: validRent,
    annualRent,
    payRate: Math.round(validPayRate * 10000) / 100,
    mortgageTermType,
    effectiveStressRate: Math.round(effectiveStressRate * 10000) / 100,
    borrowerStructure,
    icrMultiplier,
    rawIcrMaxLoan: Math.round(rawIcrMaxLoan * 100) / 100,
    ltvCeilingLoan: Math.round(ltvCeilingLoan * 100) / 100,
    targetLoanRequested: Math.round(targetLoanRequested * 100) / 100,
    actualMaxLoan: Math.round(actualMaxLoan * 100) / 100,
    isConstrainedByIcr,
    isConstrainedByLtv,
    passesStressTest,
    loanShortfall: Math.round(loanShortfall * 100) / 100,
    extraDepositNeeded: Math.round(extraDepositNeeded * 100) / 100,
    minRequiredMonthlyRent: Math.round(minRequiredMonthlyRent * 100) / 100,
    spvEffectiveLoan: Math.round(spvEffectiveLoan * 100) / 100,
    personalEffectiveLoan: Math.round(personalEffectiveLoan * 100) / 100,
    spvBorrowingAdvantage: Math.round(spvBorrowingAdvantage * 100) / 100
  };
}
