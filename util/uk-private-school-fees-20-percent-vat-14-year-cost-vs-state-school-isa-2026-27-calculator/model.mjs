// Statutory UK 2026/27 Tax Brackets & Marginal Deduction Rates (Income Tax + Class 1 Employee NI)
// Basic Rate (£12,571 - £50,270): 20% IT + 8% NI = 28% marginal rate (Keep 72%)
// Higher Rate (£50,271 - £100,000): 40% IT + 2% NI = 42% marginal rate (Keep 58%)
// Personal Allowance Taper Trap (£100,001 - £125,140): 60% effective IT + 2% NI = 62% marginal rate (Keep 38%)
// Additional Rate (£125,141+): 45% IT + 2% NI = 47% marginal rate (Keep 53%)

export const UK_TAX_BRACKETS = {
  basic: { label: 'Basic Rate (20% IT + 8% NI)', marginalRate: 0.28, netKeepRate: 0.72 },
  higher: { label: 'Higher Rate (40% IT + 2% NI)', marginalRate: 0.42, netKeepRate: 0.58 },
  taper: { label: 'Taper Trap £100k-£125k (60% IT + 2% NI)', marginalRate: 0.62, netKeepRate: 0.38 },
  additional: { label: 'Additional Rate £125k+ (45% IT + 2% NI)', marginalRate: 0.47, netKeepRate: 0.53 }
};

export function calcAnnualSchoolFee(params) {
  const {
    schoolType = 'day', // 'day' or 'boarding'
    baseTermFee = 6226, // baseline per term day £6,226 or boarding £14,980
    vatRate = 0.20,     // 20% statutory VAT
    schoolAbsorptionRate = 0.05, // e.g. 5% absorbed by school
    extrasRate = 0.12,   // uniforms, trips, music, sports 12%
    numberOfChildren = 1,
    annualInflationRate = 0.05,
    year = 1
  } = params;

  if (baseTermFee <= 0 || isNaN(baseTermFee)) throw new RangeError('Base term fee must be positive');
  if (numberOfChildren < 1 || isNaN(numberOfChildren)) throw new RangeError('Number of children must be at least 1');

  const termsPerYear = 3;
  const netVatRate = Math.max(0, vatRate - schoolAbsorptionRate);
  const termFeeWithVat = baseTermFee * (1 + netVatRate);
  const annualBasePlusVat = termFeeWithVat * termsPerYear * numberOfChildren;
  const annualWithExtras = annualBasePlusVat * (1 + extrasRate);

  // Apply annual inflation
  const inflatedAnnualFee = annualWithExtras * Math.pow(1 + annualInflationRate, year - 1);
  return {
    termFeeWithVat,
    annualBasePlusVat,
    annualWithExtras: inflatedAnnualFee,
    vatPerTerm: baseTermFee * netVatRate,
    annualVatAmount: baseTermFee * netVatRate * termsPerYear * numberOfChildren * Math.pow(1 + annualInflationRate, year - 1)
  };
}

export function calcGrossSalaryRequired(netAnnualCash, taxBracketKey = 'higher') {
  const bracket = UK_TAX_BRACKETS[taxBracketKey] || UK_TAX_BRACKETS.higher;
  if (netAnnualCash <= 0) return 0;
  return netAnnualCash / bracket.netKeepRate;
}

export function calcPrivateSchoolVsStateIsa(inputs) {
  const {
    schoolType = 'day',
    baseTermFee = schoolType === 'boarding' ? 14980 : 6226,
    vatRate = 0.20,
    schoolAbsorptionRate = 0.05,
    extrasRate = 0.12,
    numberOfChildren = 1,
    yearsRemaining = 7, // 7 (Senior 11-18) or 14 (Reception 4-18)
    annualFeeInflation = 0.05,
    taxBracketKey = 'higher',
    isaExpectedReturn = 0.065 // 6.5% real return
  } = inputs;

  if (yearsRemaining < 1 || yearsRemaining > 20) throw new RangeError('Years remaining must be between 1 and 20');
  if (numberOfChildren < 1) throw new RangeError('Number of children must be at least 1');

  const bracket = UK_TAX_BRACKETS[taxBracketKey] || UK_TAX_BRACKETS.higher;

  let cumulativePrivateFeePaid = 0;
  let cumulativeVatPaid = 0;
  let cumulativeGrossSalaryRequired = 0;
  let isaCompoundedWealth = 0;

  const yearlyBreakdown = [];

  for (let y = 1; y <= yearsRemaining; y++) {
    const feeInfo = calcAnnualSchoolFee({
      schoolType,
      baseTermFee,
      vatRate,
      schoolAbsorptionRate,
      extrasRate,
      numberOfChildren,
      annualInflationRate: annualFeeInflation,
      year: y
    });

    const annualNetFee = feeInfo.annualWithExtras;
    const annualVat = feeInfo.annualVatAmount;
    const annualGrossNeeded = annualNetFee / bracket.netKeepRate;

    cumulativePrivateFeePaid += annualNetFee;
    cumulativeVatPaid += annualVat;
    cumulativeGrossSalaryRequired += annualGrossNeeded;

    // ISA compounding: prior balance grows by return, plus end-of-year or beginning-of-year contribution
    // Assuming annual fee invested into Stocks & Shares ISA at beginning of each school year
    isaCompoundedWealth = (isaCompoundedWealth + annualNetFee) * (1 + isaExpectedReturn);

    yearlyBreakdown.push({
      year: y,
      annualNetFee: Math.round(annualNetFee),
      annualVat: Math.round(annualVat),
      annualGrossNeeded: Math.round(annualGrossNeeded),
      cumulativeNetFee: Math.round(cumulativePrivateFeePaid),
      cumulativeGrossSalary: Math.round(cumulativeGrossSalaryRequired),
      isaPortfolioValue: Math.round(isaCompoundedWealth)
    });
  }

  // Pre-tax difference / tax drag
  const totalTaxDrag = cumulativeGrossSalaryRequired - cumulativePrivateFeePaid;
  const wealthOpportunityGap = isaCompoundedWealth;

  return {
    year1: yearlyBreakdown[0],
    summary: {
      schoolType,
      yearsRemaining,
      numberOfChildren,
      taxBracketKey,
      marginalTaxRatePct: bracket.marginalRate * 100,
      totalNetFeesPaid: Math.round(cumulativePrivateFeePaid),
      totalVatPaid: Math.round(cumulativeVatPaid),
      totalGrossSalaryRequired: Math.round(cumulativeGrossSalaryRequired),
      totalTaxDrag: Math.round(totalTaxDrag),
      isaWealthAtGraduation: Math.round(isaCompoundedWealth),
      opportunityCostMultiple: (isaCompoundedWealth / cumulativePrivateFeePaid).toFixed(2)
    },
    yearlyBreakdown
  };
}
