// 2026 US IRS Offer in Compromise (OIC) Form 433-A (OIC) Reasonable Collection Potential (RCP) Model
export const IRS_QSV_DISCOUNT = 0.80; // 80% Quick Sale Value standard applied to Fair Market Value
export const LUMP_SUM_MONTHS = 12; // 12-month future income multiplier for lump sum offer (<=5 payments within 5 mo)
export const PERIODIC_MONTHS = 24; // 24-month future income multiplier for periodic payment offer (6-24 months)
export const CSED_MONTHS_MAX = 120; // 10-year (120 mo) statutory collection expiration limit (CSED)

export function calcIrsOfferInCompromise(inputs = {}) {
  const {
    taxDebt = 85000, // Total unpaid federal tax liability including penalties & interest
    cashBankBalances = 4500, // 100% equity (cash, checking, savings, money market)
    realEstateFmv = 380000, // Primary residence / real property FMV
    realEstateMortgage = 310000, // Outstanding balance on mortgages/liens
    vehiclesFmv = 24000, // Vehicles FMV
    vehiclesLoans = 14000, // Outstanding vehicle loans
    otherAssetsFmv = 8000, // Investments, crypto, personal property
    otherAssetsLoans = 2000,
    monthlyGrossIncome = 78000 / 12, // $6,500/mo
    monthlyAllowableExpenses = 5900, // IRS Collection Financial Standards (Housing, Food, Healthcare, Transp)
    monthsRemainingCsed = 72 // Remaining months before 10-year CSED runs out
  } = inputs;

  const validTaxDebt = Math.max(1000, Number(taxDebt) || 85000);
  const validCash = Math.max(0, Number(cashBankBalances) || 0);

  // 1. Asset Equity (Quick Sale Value 80% minus encumbrances, floor at $0 per asset)
  const calcEquity = (fmv, loan) => {
    const qsv = Math.max(0, Number(fmv) || 0) * IRS_QSV_DISCOUNT;
    const debt = Math.max(0, Number(loan) || 0);
    return Math.max(0, qsv - debt);
  };

  const realEstateEquity = calcEquity(realEstateFmv, realEstateMortgage);
  const vehiclesEquity = calcEquity(vehiclesFmv, vehiclesLoans);
  const otherAssetsEquity = calcEquity(otherAssetsFmv, otherAssetsLoans);
  const totalNetRealizableEquity = validCash + realEstateEquity + vehiclesEquity + otherAssetsEquity;

  // 2. Monthly Disposable Income (MDI) / Future Remaining Income
  const grossIncome = Math.max(0, Number(monthlyGrossIncome) || 0);
  const allowableExpenses = Math.max(0, Number(monthlyAllowableExpenses) || 0);
  const monthlyDisposableIncome = Math.max(0, grossIncome - allowableExpenses);

  // 3. Reasonable Collection Potential (RCP)
  // Option A: Lump Sum Cash Offer (<=5 installments within 5 months): Equity + (MDI * 12)
  const rcpLumpSum = totalNetRealizableEquity + (monthlyDisposableIncome * LUMP_SUM_MONTHS);
  const lumpSumInitialDeposit = rcpLumpSum * 0.20; // 20% non-refundable deposit required with Form 656

  // Option B: Periodic Payment Offer (6 to 24 months): Equity + (MDI * 24)
  const rcpPeriodic = totalNetRealizableEquity + (monthlyDisposableIncome * PERIODIC_MONTHS);
  const periodicMonthlyPayment = monthlyDisposableIncome > 0 ? (rcpPeriodic / 24) : (totalNetRealizableEquity / 24);

  // 4. IRS Acceptance & CSED Viability Check
  // If taxpayer can full-pay total tax debt via an Installment Agreement before CSED runs out:
  // Full-Pay threshold = totalNetRealizableEquity + (monthlyDisposableIncome * monthsRemainingCsed)
  const csedMonths = Math.max(1, Math.min(CSED_MONTHS_MAX, Number(monthsRemainingCsed) || 72));
  const fullPayCapacity = totalNetRealizableEquity + (monthlyDisposableIncome * csedMonths);
  const canFullPayBeforeCsed = fullPayCapacity >= validTaxDebt;

  // Potential Tax Savings
  const lumpSumSavings = Math.max(0, validTaxDebt - rcpLumpSum);
  const lumpSumSavingsPercent = validTaxDebt > 0 ? (lumpSumSavings / validTaxDebt) * 100 : 0;

  const periodicSavings = Math.max(0, validTaxDebt - rcpPeriodic);
  const periodicSavingsPercent = validTaxDebt > 0 ? (periodicSavings / validTaxDebt) * 100 : 0;

  // IRS Approval Probability & Evaluation
  let recommendation = 'VIABLE_OIC';
  if (rcpLumpSum >= validTaxDebt) {
    recommendation = 'OIC_NOT_VIABLE_FULL_PAY';
  } else if (canFullPayBeforeCsed) {
    recommendation = 'HIGH_RISK_FULL_PAY_INSTALLMENT';
  }

  return {
    taxDebt: Math.round(validTaxDebt * 100) / 100,
    totalNetRealizableEquity: Math.round(totalNetRealizableEquity * 100) / 100,
    realEstateEquity: Math.round(realEstateEquity * 100) / 100,
    vehiclesEquity: Math.round(vehiclesEquity * 100) / 100,
    otherAssetsEquity: Math.round(otherAssetsEquity * 100) / 100,
    monthlyGrossIncome: Math.round(grossIncome * 100) / 100,
    monthlyAllowableExpenses: Math.round(allowableExpenses * 100) / 100,
    monthlyDisposableIncome: Math.round(monthlyDisposableIncome * 100) / 100,
    // Lump Sum Offer
    rcpLumpSum: Math.round(rcpLumpSum * 100) / 100,
    lumpSumInitialDeposit: Math.round(lumpSumInitialDeposit * 100) / 100,
    lumpSumSavings: Math.round(lumpSumSavings * 100) / 100,
    lumpSumSavingsPercent: Math.round(lumpSumSavingsPercent * 100) / 100,
    // Periodic Offer
    rcpPeriodic: Math.round(rcpPeriodic * 100) / 100,
    periodicMonthlyPayment: Math.round(periodicMonthlyPayment * 100) / 100,
    periodicSavings: Math.round(periodicSavings * 100) / 100,
    periodicSavingsPercent: Math.round(periodicSavingsPercent * 100) / 100,
    // CSED analysis
    csedMonths,
    fullPayCapacity: Math.round(fullPayCapacity * 100) / 100,
    canFullPayBeforeCsed,
    recommendation
  };
}
