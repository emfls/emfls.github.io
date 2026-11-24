// 2026/27 HMRC Corporation Tax Act 2010 s.455 & Autumn Budget Rates
export const UK_TAX_CONSTANTS_2026 = {
  s455Rate: 0.3575, // 35.75% for loans on/after 6 April 2026
  dividendAllowance: 500, // £500 tax-free dividend allowance
  dividendRates: {
    basic: 0.1075, // 10.75%
    higher: 0.3575, // 35.75%
    additional: 0.3935 // 39.35%
  },
  officialRateOfInterest: 0.0375, // 3.75% HMRC ORI
  employerNiRate: 0.1500, // 15.0% Employer Class 1 & 1A NI (effective April 2025/2026)
  employerNiThreshold: 5000, // £5,000 secondary threshold
  corpTaxRates: {
    small: 0.19, // 19% under £50,000
    main: 0.25 // 25% over £250,000
  },
  bikExemptionLimit: 10000 // £10,000 de minimis limit for beneficial loans
};

export function calcDlaTax(inputs) {
  const {
    loanAmount = 50000,
    directorTaxBracket = 'higher', // basic, higher, additional
    interestPaidByDirectorPercent = 0.0, // % interest director actually pays to company
    corpTaxRateChoice = 0.25, // 0.19 or 0.25
    monthsUntilRepayment = 24 // how long loan stays overdrawn
  } = inputs;

  // 1. Option A: Leave DLA Overdrawn (Pay s455 Tax + BIK)
  const s455TaxPayable = loanAmount * UK_TAX_CONSTANTS_2026.s455Rate;

  // BIK calculation if loan > £10,000 and interest paid < Official Rate
  const interestRateShortfall = Math.max(0, UK_TAX_CONSTANTS_2026.officialRateOfInterest - (interestPaidByDirectorPercent / 100));
  const hasBik = loanAmount > UK_TAX_CONSTANTS_2026.bikExemptionLimit && interestRateShortfall > 0;
  const annualDeemedInterest = hasBik ? (loanAmount * interestRateShortfall) : 0;
  
  // Class 1A NI paid by company on deemed interest
  const annualClass1ANi = hasBik ? (annualDeemedInterest * UK_TAX_CONSTANTS_2026.employerNiRate) : 0;

  // Director personal income tax on deemed interest benefit
  let directorIncomeTaxRate = 0.40;
  if (directorTaxBracket === 'basic') directorIncomeTaxRate = 0.20;
  else if (directorTaxBracket === 'additional') directorIncomeTaxRate = 0.45;

  const annualDirectorBikTax = hasBik ? (annualDeemedInterest * directorIncomeTaxRate) : 0;
  const totalAnnualBikCost = annualClass1ANi + annualDirectorBikTax;
  const multiYearBikCost = (totalAnnualBikCost / 12) * monthsUntilRepayment;

  // Option A total immediate cash outflow (s455 + BIK over period)
  // Remember: s455 is temporarily paid to HMRC and repaid 9 months post loan repayment
  const optionACashOutflow = s455TaxPayable + multiYearBikCost;

  // 2. Option B: Clear DLA via Dividend Declaration
  // To clear a loan of £X, company declares net dividend of £X credited against DLA
  const dividendRate = UK_TAX_CONSTANTS_2026.dividendRates[directorTaxBracket] || UK_TAX_CONSTANTS_2026.dividendRates.higher;
  const taxableDividend = Math.max(0, loanAmount - UK_TAX_CONSTANTS_2026.dividendAllowance);
  const directorDividendTax = taxableDividend * dividendRate;
  
  // Company pays 0 additional tax (dividend is from retained earnings post-CT)
  // Total cost is director's personal dividend tax bill
  const optionBCost = directorDividendTax;

  // 3. Option C: Clear DLA via Bonus / Salary
  // Company awards gross bonus such that Net after PAYE and Employee NI = loanAmount,
  // OR company awards gross bonus = loanAmount.
  // In practice, company awards Gross Bonus G, where G - Employee NI - PAYE Tax = loanAmount.
  let employeeNiRate = 0.02; // higher rate earner
  let employeePayeRate = 0.40;
  if (directorTaxBracket === 'basic') {
    employeeNiRate = 0.08;
    employeePayeRate = 0.20;
  } else if (directorTaxBracket === 'additional') {
    employeeNiRate = 0.02;
    employeePayeRate = 0.45;
  }
  const netRetainedRatio = 1 - (employeeNiRate + employeePayeRate);
  const grossSalaryNeeded = loanAmount / netRetainedRatio;
  const employeeTaxAndNi = grossSalaryNeeded - loanAmount;
  const employerNiPaid = grossSalaryNeeded * UK_TAX_CONSTANTS_2026.employerNiRate;
  const totalGrossExpense = grossSalaryNeeded + employerNiPaid;
  const corpTaxSaving = totalGrossExpense * corpTaxRateChoice;
  const optionCNetCost = (totalGrossExpense - corpTaxSaving) - loanAmount;

  // Analysis & Recommendation
  let recommendation = 'Option B (Dividend)';
  let recommendationSummary = '';
  if (optionBCost < optionACashOutflow && optionBCost < optionCNetCost) {
    recommendation = 'Option B: Clear via Dividend';
    recommendationSummary = `Declaring a dividend costs £${Math.round(optionBCost).toLocaleString()} in permanent personal dividend tax, which is £${Math.round(optionACashOutflow - optionBCost).toLocaleString()} less cash outflow than the 35.75% s455 tax plus BIK charges.`;
  } else if (optionACashOutflow < optionBCost) {
    recommendation = 'Option A: Temporary s455 Loan';
    recommendationSummary = `If the company has sufficient cash and you can repay within 2–3 years, s455 is fully refundable by HMRC upon repayment.`;
  } else {
    recommendation = 'Option C: Bonus / Salary';
    recommendationSummary = `Salary extraction yields full Corporation Tax relief at ${Math.round(corpTaxRateChoice * 100)}%.`;
  }

  return {
    loanAmount: Math.round(loanAmount),
    s455RatePercent: Math.round(UK_TAX_CONSTANTS_2026.s455Rate * 10000) / 100, // 35.75%
    s455TaxPayable: Math.round(s455TaxPayable),
    hasBik,
    annualDeemedInterest: Math.round(annualDeemedInterest),
    annualClass1ANi: Math.round(annualClass1ANi),
    annualDirectorBikTax: Math.round(annualDirectorBikTax),
    totalAnnualBikCost: Math.round(totalAnnualBikCost),
    multiYearBikCost: Math.round(multiYearBikCost),
    optionACashOutflow: Math.round(optionACashOutflow),

    dividendRatePercent: Math.round(dividendRate * 10000) / 100,
    directorDividendTax: Math.round(directorDividendTax),
    optionBCost: Math.round(optionBCost),

    grossSalaryNeeded: Math.round(grossSalaryNeeded),
    employeeTaxAndNi: Math.round(employeeTaxAndNi),
    employerNiPaid: Math.round(employerNiPaid),
    corpTaxSaving: Math.round(corpTaxSaving),
    optionCNetCost: Math.round(optionCNetCost),

    differenceBVsA: Math.round(optionACashOutflow - optionBCost),
    differenceCVsB: Math.round(optionCNetCost - optionBCost),
    recommendation,
    recommendationSummary
  };
}
