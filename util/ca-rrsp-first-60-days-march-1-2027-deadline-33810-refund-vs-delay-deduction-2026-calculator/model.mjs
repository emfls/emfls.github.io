// 2026 Canada Revenue Agency (CRA) Statutory RRSP Limits, Federal & Provincial Brackets
export const CRA_RRSP_CONSTANTS_2026 = {
  dollarLimit2026: 33810, // Statutory annual dollar limit for 2026
  first60DaysDeadline: '2027-03-01', // Monday, March 1, 2027
  overcontributionBuffer: 2000, // $2,000 lifetime grace buffer
  penaltyRatePerMonth: 0.01, // 1% per month on excess over buffer (T1-OVP)
  earnedIncomeMultiplier: 0.18, // 18% of prior year earned income
  federalBrackets2026: [
    { min: 0, max: 58523, rate: 0.140, base: 0 },
    { min: 58523, max: 117045, rate: 0.205, base: 8193.22 },
    { min: 117045, max: 181440, rate: 0.260, base: 20190.23 },
    { min: 181440, max: 258482, rate: 0.290, base: 36932.93 },
    { min: 258482, max: Infinity, rate: 0.330, base: 59275.11 }
  ],
  provincialTopRates: {
    ON: 0.2053, // Ontario top marginal provincial rate (including surtax)
    BC: 0.2050, // British Columbia top marginal rate
    AB: 0.1500, // Alberta top marginal rate
    QC: 0.2575, // Quebec top provincial rate
    OTHER: 0.1500
  }
};

export function calcFederalTax2026(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  for (const b of CRA_RRSP_CONSTANTS_2026.federalBrackets2026) {
    if (taxableIncome > b.min && taxableIncome <= b.max) {
      return b.base + (taxableIncome - b.min) * b.rate;
    }
  }
  const top = CRA_RRSP_CONSTANTS_2026.federalBrackets2026[CRA_RRSP_CONSTANTS_2026.federalBrackets2026.length - 1];
  return top.base + (taxableIncome - top.min) * top.rate;
}

export function calcMarginalRate2026(taxableIncome, province = 'ON') {
  if (taxableIncome <= 0) return 0;
  let fedRate = 0.140;
  if (taxableIncome > 258482) fedRate = 0.330;
  else if (taxableIncome > 181440) fedRate = 0.290;
  else if (taxableIncome > 117045) fedRate = 0.260;
  else if (taxableIncome > 58523) fedRate = 0.205;

  const provRate = CRA_RRSP_CONSTANTS_2026.provincialTopRates[province] || 0.150;
  return fedRate + provRate;
}

export function calcRrspEconomics(inputs) {
  const earnedIncome2025 = Math.max(0, parseFloat(inputs.earnedIncome2025) || 120000);
  const unusedRoomNoa = Math.max(0, parseFloat(inputs.unusedRoomNoa) || 15000);
  const pensionAdjustment = Math.max(0, parseFloat(inputs.pensionAdjustment) || 0);
  const contribution = Math.max(0, parseFloat(inputs.contribution) || 20000);
  const taxableIncome2026 = Math.max(0, parseFloat(inputs.taxableIncome2026) || 110000);
  const expectedIncome2027 = Math.max(0, parseFloat(inputs.expectedIncome2027) || 160000);
  const province = inputs.province || 'ON';
  const hurdleRate = Math.max(0.01, (parseFloat(inputs.hurdleRate) || 6.0) / 100.0); // Discount / investment hurdle rate

  // 1. Calculate 2026 statutory limit
  const new2026Room = Math.min(earnedIncome2025 * CRA_RRSP_CONSTANTS_2026.earnedIncomeMultiplier, CRA_RRSP_CONSTANTS_2026.dollarLimit2026);
  const totalRrspDeductionLimit = Math.max(0, new2026Room + unusedRoomNoa - pensionAdjustment);

  // Check overcontribution risk
  const excessContribution = Math.max(0, contribution - totalRrspDeductionLimit);
  const penaltySubjectAmount = Math.max(0, excessContribution - CRA_RRSP_CONSTANTS_2026.overcontributionBuffer);
  const monthlyOvercontributionPenalty = penaltySubjectAmount * CRA_RRSP_CONSTANTS_2026.penaltyRatePerMonth;

  // Actual deductible contribution in 2026
  const deductible2026 = Math.min(contribution, totalRrspDeductionLimit);

  // 2. Strategy A: Claim deduction in 2026
  const fedTaxBefore = calcFederalTax2026(taxableIncome2026);
  const fedTaxAfter = calcFederalTax2026(Math.max(0, taxableIncome2026 - deductible2026));
  const fedRefund2026 = Math.max(0, fedTaxBefore - fedTaxAfter);

  const provRate = CRA_RRSP_CONSTANTS_2026.provincialTopRates[province] || 0.150;
  const provRefund2026 = deductible2026 * provRate;
  const totalRefund2026 = fedRefund2026 + provRefund2026;
  const effectiveMarginalTaxRelief = deductible2026 > 0 ? (totalRefund2026 / deductible2026) : 0;

  // 3. Strategy B: Defer deduction to 2027 tax year
  const fedTax2027Before = calcFederalTax2026(expectedIncome2027);
  const fedTax2027After = calcFederalTax2026(Math.max(0, expectedIncome2027 - deductible2026));
  const fedRefund2027 = Math.max(0, fedTax2027Before - fedTax2027After);
  const provRefund2027 = deductible2026 * provRate;
  const nominalRefund2027 = fedRefund2027 + provRefund2027;

  // Present Value (PV) of delayed refund (delayed by 1 full year)
  const pvRefund2027 = nominalRefund2027 / (1.0 + hurdleRate);
  const netAdvantageOfDeductingNow = totalRefund2026 - pvRefund2027;

  // Recommendation logic
  let recommendation = 'Deduct Now for 2026 Tax Year';
  let recommendationReason = 'Claiming now maximizes immediate cash liquidity and beats the delayed refund after discounting for 1-year investment return.';
  if (netAdvantageOfDeductingNow < -100) {
    recommendation = 'Contribute Now, Defer Deduction to 2027';
    recommendationReason = `Your expected higher income in 2027 ($${expectedIncome2027.toLocaleString()}) pushes you into a significantly higher tax bracket, generating $${Math.round(nominalRefund2027 - totalRefund2026).toLocaleString()} more refund even after discounting for time value.`;
  }

  // 4. Gross-Up RRSP Loan Strategy
  // Gross Contribution = Net Cash / (1 - marginalRate)
  const marginalRate = calcMarginalRate2026(taxableIncome2026, province);
  let grossUpContribution = deductible2026;
  let grossUpLoanNeeded = 0;
  let grossUpRefund = totalRefund2026;
  if (marginalRate > 0 && marginalRate < 0.9) {
    grossUpContribution = Math.min(totalRrspDeductionLimit, deductible2026 / (1.0 - marginalRate));
    grossUpLoanNeeded = Math.max(0, grossUpContribution - deductible2026);
    grossUpRefund = grossUpContribution * marginalRate;
  }

  return {
    earnedIncome2025,
    unusedRoomNoa,
    pensionAdjustment,
    new2026Room: Math.round(new2026Room * 100) / 100,
    totalRrspDeductionLimit: Math.round(totalRrspDeductionLimit * 100) / 100,
    contribution,
    deductible2026: Math.round(deductible2026 * 100) / 100,
    excessContribution: Math.round(excessContribution * 100) / 100,
    penaltySubjectAmount: Math.round(penaltySubjectAmount * 100) / 100,
    monthlyOvercontributionPenalty: Math.round(monthlyOvercontributionPenalty * 100) / 100,
    totalRefund2026: Math.round(totalRefund2026 * 100) / 100,
    effectiveMarginalTaxRelief: Math.round(effectiveMarginalTaxRelief * 10000) / 100, // %
    nominalRefund2027: Math.round(nominalRefund2027 * 100) / 100,
    pvRefund2027: Math.round(pvRefund2027 * 100) / 100,
    netAdvantageOfDeductingNow: Math.round(netAdvantageOfDeductingNow * 100) / 100,
    recommendation,
    recommendationReason,
    grossUpContribution: Math.round(grossUpContribution * 100) / 100,
    grossUpLoanNeeded: Math.round(grossUpLoanNeeded * 100) / 100,
    grossUpRefund: Math.round(grossUpRefund * 100) / 100,
    deadline: CRA_RRSP_CONSTANTS_2026.first60DaysDeadline,
    province
  };
}
