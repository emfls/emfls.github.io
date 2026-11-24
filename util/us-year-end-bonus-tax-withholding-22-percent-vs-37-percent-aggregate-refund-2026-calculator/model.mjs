// 2026 IRS Publication 15, Rev. Proc. 2025-32 & SSA 2026 Statutory Parameters
export const TAX_CONSTANTS_2026 = {
  ssWageBase: 184500, // 2026 SSA wage base limit
  ssTaxRate: 0.0620, // 6.2%
  medicareRate: 0.0145, // 1.45%
  addlMedicareRate: 0.0090, // 0.9% Additional Medicare
  addlMedicareThresholdSingle: 200000,
  addlMedicareThresholdMFJ: 250000,
  supplementalFlatRate: 0.22, // 22% for first $1M
  supplementalOver1MRate: 0.37, // 37% over $1M
  limit401k: 24500, // 2026 standard 401(k) limit
  standardDeduction: {
    single: 16100,
    mfj: 32200
  },
  brackets: {
    single: [
      { max: 12400, rate: 0.10 },
      { max: 50400, rate: 0.12 },
      { max: 107300, rate: 0.22 },
      { max: 205550, rate: 0.24 },
      { max: 261050, rate: 0.32 },
      { max: 652050, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ],
    mfj: [
      { max: 24800, rate: 0.10 },
      { max: 100800, rate: 0.12 },
      { max: 214600, rate: 0.22 },
      { max: 411100, rate: 0.24 },
      { max: 522100, rate: 0.32 },
      { max: 782500, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ]
  }
};

export function calcFederalIncomeTax(taxableIncome, filingStatus = 'single') {
  if (taxableIncome <= 0) return 0;
  const table = TAX_CONSTANTS_2026.brackets[filingStatus] || TAX_CONSTANTS_2026.brackets.single;
  let tax = 0;
  let prevLimit = 0;
  for (const b of table) {
    if (taxableIncome > prevLimit) {
      const taxableInBracket = Math.min(taxableIncome, b.max) - prevLimit;
      tax += taxableInBracket * b.rate;
      prevLimit = b.max;
    } else {
      break;
    }
  }
  return tax;
}

export function calcPeriodTax(periodIncome, filingStatus, payPeriods) {
  const annualized = periodIncome * payPeriods;
  const stdDed = TAX_CONSTANTS_2026.standardDeduction[filingStatus] || TAX_CONSTANTS_2026.standardDeduction.single;
  const taxableAnnual = Math.max(0, annualized - stdDed);
  const annualTax = calcFederalIncomeTax(taxableAnnual, filingStatus);
  return annualTax / payPeriods;
}

export function calcBonusTax(inputs) {
  const {
    regularSalary = 120000,
    priorYtdWages = 110000,
    bonusAmount = 25000,
    filingStatus = 'single',
    payFrequency = 'biweekly', // biweekly (26), monthly (12), semimonthly (24)
    bonus401kPercent = 0.0, // 0.0 to 1.0
    prior401kContributions = 12000
  } = inputs;

  if (regularSalary < 0 || isNaN(regularSalary)) throw new RangeError('Salary must be non-negative');
  if (bonusAmount <= 0 || isNaN(bonusAmount)) throw new RangeError('Bonus must be positive');
  if (priorYtdWages < 0 || isNaN(priorYtdWages)) throw new RangeError('Prior YTD wages must be non-negative');

  const payPeriods = payFrequency === 'monthly' ? 12 : (payFrequency === 'semimonthly' ? 24 : 26);
  const regularPeriodGross = regularSalary / payPeriods;

  // 1. 401(k) Deferral Calculation
  const remaining401kRoom = Math.max(0, TAX_CONSTANTS_2026.limit401k - prior401kContributions);
  const requested401k = bonusAmount * bonus401kPercent;
  const bonus401kDeferral = Math.min(requested401k, remaining401kRoom);
  const taxableBonusForFedTax = Math.max(0, bonusAmount - bonus401kDeferral);

  // 2. FICA Taxes (Social Security & Medicare - 401k does NOT reduce FICA wages)
  // Social Security: 6.2% up to $184,500
  const ssRemainingCapacity = Math.max(0, TAX_CONSTANTS_2026.ssWageBase - priorYtdWages);
  const ssSubjectWages = Math.min(bonusAmount, ssRemainingCapacity);
  const socialSecurityTax = ssSubjectWages * TAX_CONSTANTS_2026.ssTaxRate;
  const ssExemptWages = bonusAmount - ssSubjectWages;

  // Medicare: 1.45% on all + 0.9% Additional Medicare
  const totalWagesAfterBonus = priorYtdWages + bonusAmount;
  const addlMedicareThreshold = filingStatus === 'mfj' 
    ? TAX_CONSTANTS_2026.addlMedicareThresholdMFJ 
    : TAX_CONSTANTS_2026.addlMedicareThresholdSingle;
  
  const baseMedicareTax = bonusAmount * TAX_CONSTANTS_2026.medicareRate;
  const wagesAboveThresholdBeforeBonus = Math.max(0, priorYtdWages - addlMedicareThreshold);
  const wagesAboveThresholdAfterBonus = Math.max(0, totalWagesAfterBonus - addlMedicareThreshold);
  const bonusSubjectToAddlMedicare = wagesAboveThresholdAfterBonus - wagesAboveThresholdBeforeBonus;
  const addlMedicareTax = bonusSubjectToAddlMedicare * TAX_CONSTANTS_2026.addlMedicareRate;
  const totalMedicareTax = baseMedicareTax + addlMedicareTax;

  // 3. Federal Withholding Method A: Flat Percentage Method (22% / 37%)
  let flatWithholding = 0;
  if (taxableBonusForFedTax <= 1000000) {
    flatWithholding = taxableBonusForFedTax * TAX_CONSTANTS_2026.supplementalFlatRate;
  } else {
    flatWithholding = (1000000 * TAX_CONSTANTS_2026.supplementalFlatRate) + 
                      ((taxableBonusForFedTax - 1000000) * TAX_CONSTANTS_2026.supplementalOver1MRate);
  }

  // 4. Federal Withholding Method B: Aggregate Method
  const regularPeriodTax = calcPeriodTax(regularPeriodGross, filingStatus, payPeriods);
  const combinedPeriodGross = regularPeriodGross + taxableBonusForFedTax;
  const combinedPeriodTax = calcPeriodTax(combinedPeriodGross, filingStatus, payPeriods);
  const aggregateWithholding = Math.max(0, combinedPeriodTax - regularPeriodTax);

  // 5. True 2026 Annual Marginal Federal Tax Liability
  const stdDed = TAX_CONSTANTS_2026.standardDeduction[filingStatus] || TAX_CONSTANTS_2026.standardDeduction.single;
  const baseAnnualTaxable = Math.max(0, regularSalary - prior401kContributions - stdDed);
  const baseAnnualTax = calcFederalIncomeTax(baseAnnualTaxable, filingStatus);

  const totalAnnualTaxableWithBonus = Math.max(0, regularSalary + bonusAmount - (prior401kContributions + bonus401kDeferral) - stdDed);
  const totalAnnualTaxWithBonus = calcFederalIncomeTax(totalAnnualTaxableWithBonus, filingStatus);
  const trueMarginalFedTax = totalAnnualTaxWithBonus - baseAnnualTax;
  const trueEffectiveTaxRateOnBonus = bonusAmount > 0 ? (trueMarginalFedTax / bonusAmount) : 0;

  // 6. Over/Under Withholding Analysis (April 2027 Tax Return Reconciliation)
  // For Flat 22%:
  const flatDifference = flatWithholding - trueMarginalFedTax;
  const flatIsRefund = flatDifference >= 0;
  const flatRefundOrOwed = Math.abs(flatDifference);

  // For Aggregate Method:
  const aggregateDifference = aggregateWithholding - trueMarginalFedTax;
  const aggregateIsRefund = aggregateDifference >= 0;
  const aggregateRefundOrOwed = Math.abs(aggregateDifference);

  // 7. Net Take-Home Bonus Cash
  const flatNetTakeHome = bonusAmount - bonus401kDeferral - flatWithholding - socialSecurityTax - totalMedicareTax;
  const aggregateNetTakeHome = bonusAmount - bonus401kDeferral - aggregateWithholding - socialSecurityTax - totalMedicareTax;

  return {
    bonusAmount,
    bonus401kDeferral,
    taxableBonusForFedTax,
    fica: {
      ssSubjectWages,
      ssExemptWages,
      socialSecurityTax,
      baseMedicareTax,
      addlMedicareTax,
      totalMedicareTax,
      totalFica: socialSecurityTax + totalMedicareTax
    },
    flatMethod: {
      withholdingRate: taxableBonusForFedTax > 1000000 ? 'Blended 22%/37%' : '22.0%',
      federalWithholding: flatWithholding,
      netTakeHome: flatNetTakeHome,
      taxDifference: flatDifference,
      isRefund: flatIsRefund,
      refundOrOwed: flatRefundOrOwed
    },
    aggregateMethod: {
      federalWithholding: aggregateWithholding,
      netTakeHome: aggregateNetTakeHome,
      taxDifference: aggregateDifference,
      isRefund: aggregateIsRefund,
      refundOrOwed: aggregateRefundOrOwed
    },
    trueLiability: {
      marginalTax: trueMarginalFedTax,
      effectiveBonusRate: trueEffectiveTaxRateOnBonus * 100
    }
  };
}
