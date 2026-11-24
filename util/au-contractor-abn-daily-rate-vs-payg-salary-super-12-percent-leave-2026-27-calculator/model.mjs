// AU Contractor ABN Daily Rate vs PAYG Salary Engine (FY 2026–27 Stage 3 Tax & 12% Super)

export function calculateAtoResidentTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  if (taxableIncome <= 18200) return 0;
  if (taxableIncome <= 45000) {
    return (taxableIncome - 18200) * 0.16;
  }
  if (taxableIncome <= 135000) {
    return 4288 + (taxableIncome - 45000) * 0.30;
  }
  if (taxableIncome <= 190000) {
    return 31288 + (taxableIncome - 135000) * 0.37;
  }
  return 51638 + (taxableIncome - 190000) * 0.45;
}

export function calculateMedicareLevy(taxableIncome) {
  if (taxableIncome <= 26000) return 0; // approximate low income shade-in
  return taxableIncome * 0.02;
}

export function calculateContractorVsPayg(params) {
  const {
    baseSalary,
    superRatePct = 12.0,
    annualLeaveDays = 20,
    sickLeaveDays = 10,
    publicHolidays = 11,
    benchDays = 10,
    annualOverheads = 5000,
    riskPremiumPct = 15.0,
    offeredDailyRate = 0,
    workHoursPerDay = 7.6
  } = params;

  if (baseSalary <= 0) {
    throw new RangeError("Base salary must be positive.");
  }

  // 12% Superannuation Guarantee capped at FY 2026-27 Maximum Contribution Base ($260,280)
  const maxSuperBase = 260280;
  const eligibleSuperSalary = Math.min(baseSalary, maxSuperBase);
  const paygSuper = eligibleSuperSalary * (superRatePct / 100);
  const totalPaygPackage = baseSalary + paygSuper;

  // Billable days calculation
  const totalWeekdays = 260; // 52 weeks * 5 days
  const nonBillableDays = annualLeaveDays + sickLeaveDays + publicHolidays + benchDays;
  const billableDays = Math.max(80, totalWeekdays - nonBillableDays);

  // Required contractor annual revenue (Ex-GST) to match PAYG Package + Business Overheads
  const requiredRevenueBreakeven = totalPaygPackage + annualOverheads;
  const requiredRevenueRecommended = (totalPaygPackage * (1 + riskPremiumPct / 100)) + annualOverheads;

  const breakevenDailyRateExGst = requiredRevenueBreakeven / billableDays;
  const recommendedDailyRateExGst = requiredRevenueRecommended / billableDays;

  // GST Registration Threshold: $75,000 turnover
  const isGstMandatory = requiredRevenueBreakeven >= 75000;
  const breakevenDailyRateIncGst = isGstMandatory ? breakevenDailyRateExGst * 1.10 : breakevenDailyRateExGst;
  const recommendedDailyRateIncGst = isGstMandatory ? recommendedDailyRateExGst * 1.10 : recommendedDailyRateExGst;

  const breakevenHourlyRate = breakevenDailyRateExGst / workHoursPerDay;
  const recommendedHourlyRate = recommendedDailyRateExGst / workHoursPerDay;

  // PAYG Net Take-Home Pay
  const paygTax = calculateAtoResidentTax(baseSalary);
  const paygMedicare = calculateMedicareLevy(baseSalary);
  const paygNetTakeHome = baseSalary - (paygTax + paygMedicare);

  // If offered daily rate provided, compare net outcomes
  let offeredContractorNet = 0;
  let offeredRevenueExGst = 0;
  let contractorTax = 0;
  let contractorMedicare = 0;
  let netTakeHomeAdvantage = 0;

  if (offeredDailyRate > 0) {
    offeredRevenueExGst = offeredDailyRate * billableDays;
    // Contractor funds own super & overheads
    const contractorTaxableIncome = Math.max(0, offeredRevenueExGst - annualOverheads - paygSuper);
    contractorTax = calculateAtoResidentTax(contractorTaxableIncome);
    contractorMedicare = calculateMedicareLevy(contractorTaxableIncome);
    offeredContractorNet = contractorTaxableIncome - (contractorTax + contractorMedicare);
    netTakeHomeAdvantage = offeredContractorNet - paygNetTakeHome;
  }

  return {
    baseSalary,
    paygSuper,
    totalPaygPackage,
    billableDays,
    nonBillableDays,
    requiredRevenueBreakeven,
    breakevenDailyRateExGst,
    breakevenDailyRateIncGst,
    recommendedDailyRateExGst,
    recommendedDailyRateIncGst,
    breakevenHourlyRate,
    recommendedHourlyRate,
    isGstMandatory,
    paygNetTakeHome,
    offeredDailyRate,
    offeredRevenueExGst,
    offeredContractorNet,
    netTakeHomeAdvantage
  };
}
