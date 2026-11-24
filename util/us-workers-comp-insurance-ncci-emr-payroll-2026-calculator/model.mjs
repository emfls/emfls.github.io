// 2026 Statutory NCCI Classification Codes, EMR (Experience Modification Rate) and Workers' Compensation Parameters
export const NCCI_CLASS_CODES_2026 = {
  "8810": { code: "8810", title: "Clerical Office Employees", rate: 0.22, risk: "Low Risk (Office/Admin)" },
  "9079": { code: "9079", title: "Restaurants: Full-Service & Food Prep", rate: 1.85, risk: "Moderate Risk (Hospitality)" },
  "5190": { code: "5190", title: "Electrical Wiring - Within Buildings", rate: 3.10, risk: "Moderate-High (Skilled Trades)" },
  "5403": { code: "5403", title: "Carpentry - Framing / Residential", rate: 8.50, risk: "High Risk (Construction)" },
  "7219": { code: "7219", title: "Trucking: Local & Long Distance Hauling", rate: 9.80, risk: "High Risk (Transportation)" },
  "5551": { code: "5551", title: "Roofing: All Kinds & Yard Employees", rate: 19.50, risk: "Extreme Risk (Heights)" }
};

export const DEFAULT_EXPENSE_CONSTANT = 250;
export const DEFAULT_TRIA_RATE = 0.02; // $0.02 per $100 payroll (Terrorism Risk Insurance Act)
export const DEFAULT_STATE_ASSESSMENT_RATE = 2.5; // 2.5% of modified premium

export function calcWorkersComp(inputs = {}) {
  const {
    payroll = 500000,
    ncciCode = "5403",
    customRate = 5.00,
    emr = 1.00,
    expenseConstant = DEFAULT_EXPENSE_CONSTANT,
    triaRate = DEFAULT_TRIA_RATE,
    stateAssessmentRate = DEFAULT_STATE_ASSESSMENT_RATE
  } = inputs;

  const validPayroll = Math.max(0, Number(payroll) || 0);
  const selectedCodeInfo = NCCI_CLASS_CODES_2026[ncciCode];
  const rateUsed = selectedCodeInfo ? selectedCodeInfo.rate : Math.max(0, Number(customRate) || 0);
  const validEmr = Math.max(0.50, Math.min(2.50, Number(emr) || 1.00));
  const validExpense = Math.max(0, Number(expenseConstant) || 0);
  const validTriaRate = Math.max(0, Number(triaRate) || 0);
  const validAssessmentRate = Math.max(0, Number(stateAssessmentRate) || 0);

  // Manual Premium = (Payroll / 100) * Manual Rate
  const manualPremium = (validPayroll / 100) * rateUsed;

  // EMR Adjustment = Manual Premium * (EMR - 1.0)
  const emrAdjustment = manualPremium * (validEmr - 1.0);
  const modifiedPremium = manualPremium * validEmr;

  // Surcharges & Fees
  const triaSurcharge = (validPayroll / 100) * validTriaRate;
  const stateAssessment = modifiedPremium * (validAssessmentRate / 100);

  // Total Estimated Annual Premium
  const totalAnnualPremium = modifiedPremium + validExpense + triaSurcharge + stateAssessment;
  const monthlyPremium = totalAnnualPremium / 12;
  const costPerThousandPayroll = validPayroll > 0 ? (totalAnnualPremium / validPayroll) * 1000 : 0;

  // Benchmarks for Safety ROI: EMR 1.00 (Standard) vs EMR 0.80 (20% Credit) vs EMR 1.25 (25% Debit)
  const baseMod100 = manualPremium * 1.00;
  const baseTotal100 = baseMod100 + validExpense + triaSurcharge + (baseMod100 * (validAssessmentRate / 100));

  const mod080 = manualPremium * 0.80;
  const total080 = mod080 + validExpense + triaSurcharge + (mod080 * (validAssessmentRate / 100));
  const annualSavings080 = baseTotal100 - total080;
  const threeYearRoi080 = annualSavings080 * 3;

  const mod125 = manualPremium * 1.25;
  const total125 = mod125 + validExpense + triaSurcharge + (mod125 * (validAssessmentRate / 100));
  const annualPenalty125 = total125 - baseTotal100;
  const threeYearLoss125 = annualPenalty125 * 3;

  return {
    payroll: validPayroll,
    ncciCode,
    ncciTitle: selectedCodeInfo ? selectedCodeInfo.title : "Custom Classification",
    rateUsed: Math.round(rateUsed * 100) / 100,
    manualPremium: Math.round(manualPremium * 100) / 100,
    emr: Math.round(validEmr * 100) / 100,
    emrAdjustment: Math.round(emrAdjustment * 100) / 100,
    isEmrCredit: validEmr < 1.00,
    isEmrDebit: validEmr > 1.00,
    modifiedPremium: Math.round(modifiedPremium * 100) / 100,
    expenseConstant: validExpense,
    triaSurcharge: Math.round(triaSurcharge * 100) / 100,
    stateAssessment: Math.round(stateAssessment * 100) / 100,
    totalAnnualPremium: Math.round(totalAnnualPremium * 100) / 100,
    monthlyPremium: Math.round(monthlyPremium * 100) / 100,
    costPerThousandPayroll: Math.round(costPerThousandPayroll * 100) / 100,
    benchmarks: {
      totalAt100: Math.round(baseTotal100 * 100) / 100,
      totalAt080: Math.round(total080 * 100) / 100,
      annualSavings080: Math.round(annualSavings080 * 100) / 100,
      threeYearRoi080: Math.round(threeYearRoi080 * 100) / 100,
      totalAt125: Math.round(total125 * 100) / 100,
      annualPenalty125: Math.round(annualPenalty125 * 100) / 100,
      threeYearLoss125: Math.round(threeYearLoss125 * 100) / 100
    }
  };
}
