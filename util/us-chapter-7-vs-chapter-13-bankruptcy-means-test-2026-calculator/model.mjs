/**
 * Tool 509: 2026 US Chapter 7 vs Chapter 13 Bankruptcy Means Test Model (Form 122A-2 / 11 U.S.C. § 707(b)(2))
 */

export const STATE_MEDIANS_2026 = {
  CA: { name: 'California', medians: [78500, 99800, 112000, 131500], perAdd: 10200 },
  TX: { name: 'Texas', medians: [64200, 83500, 91000, 108000], perAdd: 9900 },
  FL: { name: 'Florida', medians: [65000, 82000, 90500, 106000], perAdd: 9900 },
  NY: { name: 'New York', medians: [75000, 95000, 109000, 128000], perAdd: 10200 },
  IL: { name: 'Illinois', medians: [71000, 89500, 102000, 120500], perAdd: 10000 },
  PA: { name: 'Pennsylvania', medians: [66500, 84000, 94500, 111000], perAdd: 9900 },
  OH: { name: 'Ohio', medians: [62000, 78500, 88000, 104000], perAdd: 9800 },
  NATIONAL: { name: 'National Average', medians: [68000, 86000, 98000, 115000], perAdd: 10000 }
};

export function getStateMedian(stateCode, householdSize, customMedian = 0) {
  if (customMedian > 0) return customMedian;
  const state = STATE_MEDIANS_2026[stateCode] || STATE_MEDIANS_2026.NATIONAL;
  const size = Math.max(1, parseInt(householdSize, 10) || 1);
  if (size <= 4) {
    return state.medians[size - 1];
  }
  return state.medians[3] + (size - 4) * state.perAdd;
}

export function calculateMeansTest(params) {
  const {
    state = 'NATIONAL',
    householdSize = 1,
    customMedian = 0,
    monthlyGrossIncome = 0, // CMI (excludes Social Security)
    irsNationalStandard = 850, // Food, clothing, household
    irsHousingStandard = 1450, // Mortgage/rent & utilities
    irsVehicleStandard = 600, // Operating & ownership
    payrollTaxes = 0,
    mandatoryRetirement = 0,
    healthInsurance = 0,
    securedDebtPayments = 0, // monthly mortgage, car loan payments
    priorityDebtPayments = 0, // child support, tax debts
    generalUnsecuredDebt = 0 // credit cards, medical bills, personal loans
  } = params;

  const hSize = Math.max(1, parseInt(householdSize, 10) || 1);
  const cmi = Math.max(0, parseFloat(monthlyGrossIncome) || 0);
  const annualizedCmi = cmi * 12;
  const stateMedian = getStateMedian(state, hSize, parseFloat(customMedian) || 0);

  // Step 1: Median Income Comparison
  const isBelowMedian = annualizedCmi <= stateMedian;
  const step1Passed = isBelowMedian;

  // Step 2: Form 122A-2 Expense Deductions
  const totalAllowableExpenses = (
    Math.max(0, parseFloat(irsNationalStandard) || 0) +
    Math.max(0, parseFloat(irsHousingStandard) || 0) +
    Math.max(0, parseFloat(irsVehicleStandard) || 0) +
    Math.max(0, parseFloat(payrollTaxes) || 0) +
    Math.max(0, parseFloat(mandatoryRetirement) || 0) +
    Math.max(0, parseFloat(healthInsurance) || 0) +
    Math.max(0, parseFloat(securedDebtPayments) || 0) +
    Math.max(0, parseFloat(priorityDebtPayments) || 0)
  );

  const monthlyDisposableIncome = Math.max(0, cmi - totalAllowableExpenses);
  const sixtyMonthDisposableIncome = monthlyDisposableIncome * 60;
  const unsecuredDebt = Math.max(0, parseFloat(generalUnsecuredDebt) || 0);

  // 11 U.S.C. § 707(b)(2) Presumption of Abuse determination
  let presumptionOfAbuse = false;
  let statusMessage = '';

  if (isBelowMedian) {
    presumptionOfAbuse = false;
    statusMessage = 'Safe Harbor: Annualized CMI is at or below state median income. Presumption of abuse does NOT arise. Debtor qualifies for Chapter 7 without completing the expense Means Test.';
  } else {
    // Above median
    if (sixtyMonthDisposableIncome < 10000) {
      presumptionOfAbuse = false;
      statusMessage = 'Passed Step 2: 60-Month Disposable Income is under $10,000 ($166.67/mo). Presumption of abuse does NOT arise. Debtor qualifies for Chapter 7 liquidation.';
    } else if (sixtyMonthDisposableIncome > 16000) {
      presumptionOfAbuse = true;
      statusMessage = 'Presumption of Abuse Arises: 60-Month Disposable Income exceeds $16,000 ($266.67/mo). Debtor is generally barred from Chapter 7 unless special circumstances exist, and must file Chapter 13.';
    } else {
      // Between $10,000 and $16,000: test 25% of general unsecured debt
      const twentyFivePercentUnsecured = unsecuredDebt * 0.25;
      if (sixtyMonthDisposableIncome >= twentyFivePercentUnsecured) {
        presumptionOfAbuse = true;
        statusMessage = `Presumption of Abuse Arises: 60-Month Disposable Income ($${sixtyMonthDisposableIncome.toLocaleString()}) pays 25%+ of unsecured debt ($${twentyFivePercentUnsecured.toLocaleString()}). Chapter 13 filing required.`;
      } else {
        presumptionOfAbuse = false;
        statusMessage = `Passed Step 2: 60-Month Disposable Income ($${sixtyMonthDisposableIncome.toLocaleString()}) pays less than 25% of unsecured debt ($${twentyFivePercentUnsecured.toLocaleString()}). Presumption of abuse does not arise.`;
      }
    }
  }

  // Chapter 13 36-Month vs 60-Month Repayment Plan Projection
  const commitmentMonths = isBelowMedian ? 36 : 60;
  const chapter13MonthlyPayment = Math.max(50, monthlyDisposableIncome);
  const chapter13TotalPlanPayments = chapter13MonthlyPayment * commitmentMonths;
  const totalDebt = unsecuredDebt + (parseFloat(priorityDebtPayments) || 0) * commitmentMonths;
  const estimatedUnsecuredDischarge = Math.max(0, unsecuredDebt - chapter13TotalPlanPayments);

  return {
    state,
    householdSize: hSize,
    monthlyGrossIncome: cmi,
    annualizedCmi,
    stateMedian,
    isBelowMedian,
    totalAllowableExpenses,
    monthlyDisposableIncome,
    sixtyMonthDisposableIncome,
    presumptionOfAbuse,
    statusMessage,
    recommendedChapter: presumptionOfAbuse ? 'Chapter 13' : 'Chapter 7',
    chapter13: {
      commitmentMonths,
      monthlyPlanPayment: chapter13MonthlyPayment,
      totalPlanPayments: chapter13TotalPlanPayments,
      estimatedUnsecuredDischarge,
      percentageDischarge: unsecuredDebt > 0 ? Math.min(100, (estimatedUnsecuredDischarge / unsecuredDebt) * 100) : 0
    }
  };
}
