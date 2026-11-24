// FY 2026–27 ATO Statutory Tax Rates, Stage 3 Tax Cuts, Medicare & Superannuation Guarantee (SG)
export const ATO_RATES_2026_27 = {
  superGuaranteeRate: 0.120, // 12.0% SG rate
  concessionalSuperCap: 32500, // Concessional super cap
  medicareRate: 0.020, // 2.0% Medicare levy
  medicareThresholdSingle: 26000,
  taxBrackets: [
    { min: 0, max: 18200, rate: 0.00, base: 0 },
    { min: 18200, max: 45000, rate: 0.16, base: 0 },
    { min: 45000, max: 135000, rate: 0.30, base: 4288 },
    { min: 135000, max: 190000, rate: 0.37, base: 31288 },
    { min: 190000, max: Infinity, rate: 0.45, base: 51638 }
  ],
  hecs: {
    minThreshold: 69528,
    tier1Max: 129717,
    tier2Max: 186050,
    topRate: 0.100
  },
  defaultLeaveLoadingRate: 0.175 // Standard 17.5% Modern Award Loading
};

export function calcAuIncomeTax(taxableIncome) {
  if (taxableIncome <= 18200) return 0;
  for (const b of ATO_RATES_2026_27.taxBrackets) {
    if (taxableIncome > b.min && taxableIncome <= b.max) {
      return b.base + (taxableIncome - b.min) * b.rate;
    }
  }
  const top = ATO_RATES_2026_27.taxBrackets[ATO_RATES_2026_27.taxBrackets.length - 1];
  return top.base + (taxableIncome - top.min) * top.rate;
}

export function calcMedicareLevy(taxableIncome) {
  if (taxableIncome <= ATO_RATES_2026_27.medicareThresholdSingle) return 0;
  if (taxableIncome < 32500) {
    return (taxableIncome - ATO_RATES_2026_27.medicareThresholdSingle) * 0.10;
  }
  return taxableIncome * ATO_RATES_2026_27.medicareRate;
}

export function calcHecsRepayment(income) {
  if (income <= ATO_RATES_2026_27.hecs.minThreshold) return 0;
  if (income <= ATO_RATES_2026_27.hecs.tier1Max) {
    return (income - ATO_RATES_2026_27.hecs.minThreshold) * 0.15;
  }
  if (income <= ATO_RATES_2026_27.hecs.tier2Max) {
    return 9028 + (income - ATO_RATES_2026_27.hecs.tier1Max) * 0.17;
  }
  return income * ATO_RATES_2026_27.hecs.topRate;
}

export function calcLeaveLoading(inputs) {
  const annualSalary = Math.max(0, parseFloat(inputs.annualSalary) || 95000);
  const leaveWeeks = Math.max(0.1, Math.min(12, parseFloat(inputs.leaveWeeks) || 4));
  const loadingRate = Math.max(0, parseFloat(inputs.loadingRate) !== undefined ? parseFloat(inputs.loadingRate) : 0.175);
  const hasHecs = Boolean(inputs.hasHecs);
  const isOvertimeExempt = Boolean(inputs.isOvertimeExempt); // SGR 2009/2 overtime compensation exemption
  const payFrequency = inputs.payFrequency || 'fortnightly'; // weekly (52), fortnightly (26), monthly (12)

  // Frequency divisor
  let periodsPerYear = 26;
  if (payFrequency === 'weekly') periodsPerYear = 52;
  else if (payFrequency === 'monthly') periodsPerYear = 12;

  const weeklyOrdinaryPay = annualSalary / 52.0;
  const baseHolidayPay = weeklyOrdinaryPay * leaveWeeks;
  const leaveLoadingAmount = baseHolidayPay * loadingRate;
  const grossLeavePay = baseHolidayPay + leaveLoadingAmount;

  // Tax calculation: Base salary annual tax vs Annual salary + Leave Loading
  // In Australia, base holiday pay is regular salary, while leave loading is an additional allowance
  const regularAnnualTax = calcAuIncomeTax(annualSalary) + calcMedicareLevy(annualSalary) + (hasHecs ? calcHecsRepayment(annualSalary) : 0);
  
  // Total income if leave loading is received on top of annual base
  const totalAnnualWithLoading = annualSalary + leaveLoadingAmount;
  const totalAnnualTax = calcAuIncomeTax(totalAnnualWithLoading) + calcMedicareLevy(totalAnnualWithLoading) + (hasHecs ? calcHecsRepayment(totalAnnualWithLoading) : 0);
  
  const marginalTaxOnLoading = Math.max(0, totalAnnualTax - regularAnnualTax);
  const effectiveTaxRateOnLoading = leaveLoadingAmount > 0 ? (marginalTaxOnLoading / leaveLoadingAmount) : 0;

  // Withholding on total leave payment for the period
  const leaveFractionOfYear = leaveWeeks / 52.0;
  const taxOnBaseHolidayPay = regularAnnualTax * leaveFractionOfYear;
  const totalTaxWithheldOnLeavePay = taxOnBaseHolidayPay + marginalTaxOnLoading;
  const netTakeHomeLeavePay = grossLeavePay - totalTaxWithheldOnLeavePay;

  // Superannuation Guarantee (12.0%) Calculation under ATO SGR 2009/2
  const sgRate = ATO_RATES_2026_27.superGuaranteeRate;
  const superOnBaseHolidayPay = baseHolidayPay * sgRate; // Base holiday pay is ALWAYS Ordinary Time Earnings (OTE)
  
  // Under SGR 2009/2, leave loading is OTE UNLESS demonstrably paid to compensate for lost overtime
  const superOnLoading = isOvertimeExempt ? 0 : (leaveLoadingAmount * sgRate);
  const totalSuperContribution = superOnBaseHolidayPay + superOnLoading;

  return {
    annualSalary,
    leaveWeeks,
    loadingRate,
    payFrequency,
    weeklyOrdinaryPay: Math.round(weeklyOrdinaryPay * 100) / 100,
    baseHolidayPay: Math.round(baseHolidayPay * 100) / 100,
    leaveLoadingAmount: Math.round(leaveLoadingAmount * 100) / 100,
    grossLeavePay: Math.round(grossLeavePay * 100) / 100,
    marginalTaxOnLoading: Math.round(marginalTaxOnLoading * 100) / 100,
    effectiveTaxRateOnLoading: Math.round(effectiveTaxRateOnLoading * 10000) / 100, // percentage
    taxOnBaseHolidayPay: Math.round(taxOnBaseHolidayPay * 100) / 100,
    totalTaxWithheldOnLeavePay: Math.round(totalTaxWithheldOnLeavePay * 100) / 100,
    netTakeHomeLeavePay: Math.round(netTakeHomeLeavePay * 100) / 100,
    superOnBaseHolidayPay: Math.round(superOnBaseHolidayPay * 100) / 100,
    superOnLoading: Math.round(superOnLoading * 100) / 100,
    totalSuperContribution: Math.round(totalSuperContribution * 100) / 100,
    isOvertimeExempt,
    hasHecs
  };
}
