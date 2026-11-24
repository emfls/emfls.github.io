// Canadian CMHC MLI Select Underwriting Engine (2026 Standards)
export function calcCanadianSemiAnnualMonthlyPayment(principal, annualNominalRate, months) {
  if (principal <= 0) return 0;
  if (annualNominalRate <= 0) return principal / months;

  // Canadian statutory semi-annual compounding conversion to effective monthly rate:
  // rm = (1 + r / 2)^(2 / 12) - 1
  const rm = Math.pow(1 + annualNominalRate / 2, 2 / 12) - 1;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function getMLISelectCriteria(tierPoints) {
  if (tierPoints >= 100) {
    return { maxLTV: 0.95, minDCR: 1.10, maxAmortYears: 50, premiumPct: 0.0155 };
  } else if (tierPoints >= 70) {
    return { maxLTV: 0.95, minDCR: 1.10, maxAmortYears: 40, premiumPct: 0.0275 };
  } else if (tierPoints >= 50) {
    return { maxLTV: 0.85, minDCR: 1.15, maxAmortYears: 35, premiumPct: 0.0375 };
  }
  throw new Error('Minimum 50 points required to qualify for CMHC MLI Select');
}

export function computeCMHCMLISelect(inputs) {
  const {
    propertyValue = 5000000,
    annualNOI = 280000,
    tierPoints = 100,
    interestRateCMHC = 0.0465,
    interestRateConventional = 0.0585
  } = inputs;

  if (propertyValue <= 0 || isNaN(propertyValue)) throw new RangeError('Property value must be positive');
  if (annualNOI <= 0 || isNaN(annualNOI)) throw new RangeError('Annual NOI must be positive');

  const criteria = getMLISelectCriteria(tierPoints);

  // 1. CMHC MLI Select Loan Amount (Dual Constraint: LTV cap vs DCR cap)
  const maxLoanByLTV = propertyValue * criteria.maxLTV;

  // Max loan by DCR: NOI / minDCR = max annual debt service
  // Max loan = maxAnnualDebtService / (monthlyPaymentFactor * 12)
  const cmhcMonths = criteria.maxAmortYears * 12;
  const unitCMHCPmt = calcCanadianSemiAnnualMonthlyPayment(1, interestRateCMHC, cmhcMonths);
  const maxDebtServiceCMHC = annualNOI / criteria.minDCR;
  const maxLoanByDCR = maxDebtServiceCMHC / (unitCMHCPmt * 12);

  const eligibleLoanCMHC = Math.min(maxLoanByLTV, maxLoanByDCR);
  const bindingConstraintCMHC = eligibleLoanCMHC === maxLoanByLTV ? 'LTV' : 'DCR';
  const downPaymentCMHC = propertyValue - eligibleLoanCMHC;
  const monthlyPaymentCMHC = calcCanadianSemiAnnualMonthlyPayment(eligibleLoanCMHC, interestRateCMHC, cmhcMonths);
  const annualDebtCMHC = monthlyPaymentCMHC * 12;
  const netCashFlowCMHC = annualNOI - annualDebtCMHC;
  const cocReturnCMHC = downPaymentCMHC > 0 ? (netCashFlowCMHC / downPaymentCMHC) * 100 : 0;

  // 2. Conventional Multi-Unit Commercial Loan Benchmark (75% LTV, 1.25x DCR, 25-yr amort)
  const convLTVCap = 0.75;
  const convMinDCR = 1.25;
  const convMonths = 25 * 12;
  const maxLoanConvLTV = propertyValue * convLTVCap;
  const unitConvPmt = calcCanadianSemiAnnualMonthlyPayment(1, interestRateConventional, convMonths);
  const maxDebtServiceConv = annualNOI / convMinDCR;
  const maxLoanConvDCR = maxDebtServiceConv / (unitConvPmt * 12);

  const eligibleLoanConv = Math.min(maxLoanConvLTV, maxLoanConvDCR);
  const bindingConstraintConv = eligibleLoanConv === maxLoanConvLTV ? 'LTV' : 'DCR';
  const downPaymentConv = propertyValue - eligibleLoanConv;
  const monthlyPaymentConv = calcCanadianSemiAnnualMonthlyPayment(eligibleLoanConv, interestRateConventional, convMonths);
  const annualDebtConv = monthlyPaymentConv * 12;
  const netCashFlowConv = annualNOI - annualDebtConv;
  const cocReturnConv = downPaymentConv > 0 ? (netCashFlowConv / downPaymentConv) * 100 : 0;

  const equitySaved = downPaymentConv - downPaymentCMHC;

  return {
    propertyValue,
    annualNOI,
    tierPoints,
    criteria,
    equitySaved,
    cmhc: {
      eligibleLoan: eligibleLoanCMHC,
      bindingConstraint: bindingConstraintCMHC,
      downPayment: downPaymentCMHC,
      monthlyPayment: monthlyPaymentCMHC,
      annualDebtService: annualDebtCMHC,
      netCashFlow: netCashFlowCMHC,
      cashOnCashReturn: cocReturnCMHC
    },
    conventional: {
      eligibleLoan: eligibleLoanConv,
      bindingConstraint: bindingConstraintConv,
      downPayment: downPaymentConv,
      monthlyPayment: monthlyPaymentConv,
      annualDebtService: annualDebtConv,
      netCashFlow: netCashFlowConv,
      cashOnCashReturn: cocReturnConv
    }
  };
}
