// FY 2026–27 ATO Statutory Tax Rates, Stage 3 Tax Cuts, Schedule 5 & HECS-HELP Parameters
export const ATO_RATES_2026_27 = {
  superGuaranteeRate: 0.120, // 12.0% SG on OTE bonuses
  concessionalSuperCap: 32500, // FY27 Concessional Cap
  superContributionsTax: 0.150, // 15% inside super
  medicareRate: 0.020, // 2.0%
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
    tier1Max: 129717, // 15% on excess over $69,528
    tier2Max: 186050, // $9,028 + 17% on excess over $129,718
    topRate: 0.100 // 10% of total repayment income above $186,050
  }
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
  // Phase-in between $26k and $32.5k, standard 2% above
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

export function calcTotalAuAnnualTax(income, hasHecs = false) {
  const incTax = calcAuIncomeTax(income);
  const medLevy = calcMedicareLevy(income);
  const hecs = hasHecs ? calcHecsRepayment(income) : 0;
  return incTax + medLevy + hecs;
}

export function calcPeriodWithholding(periodGross, payPeriods, hasHecs = false) {
  const annualized = periodGross * payPeriods;
  const annualTax = calcTotalAuAnnualTax(annualized, hasHecs);
  return annualTax / payPeriods;
}

export function calcAuBonusWithholding(inputs) {
  const {
    regularAnnualSalary = 110000,
    payFrequency = 'fortnightly', // fortnightly (26) or monthly (12)
    bonusAmount = 15000,
    hasHecs = false,
    salarySacrificeSuper = 0,
    priorSuperContributions = 12000
  } = inputs;

  if (regularAnnualSalary < 0 || isNaN(regularAnnualSalary)) throw new RangeError('Salary must be non-negative');
  if (bonusAmount <= 0 || isNaN(bonusAmount)) throw new RangeError('Bonus must be positive');

  const payPeriods = payFrequency === 'monthly' ? 12 : 26;
  const regularPeriodGross = regularAnnualSalary / payPeriods;

  // 1. Super Guarantee (12.0% on OTE bonus)
  const superGuaranteeAmount = bonusAmount * ATO_RATES_2026_27.superGuaranteeRate;

  // 2. Salary Sacrifice to Super
  const maxSacrificeRoom = Math.max(0, ATO_RATES_2026_27.concessionalSuperCap - priorSuperContributions);
  const actualSalarySacrifice = Math.min(salarySacrificeSuper, maxSacrificeRoom, bonusAmount);
  const taxableBonus = Math.max(0, bonusAmount - actualSalarySacrifice);

  // 3. Method A Withholding (ATO Schedule 5)
  // Apportion bonus across all pay periods in year
  const bonusPerPeriod = taxableBonus / payPeriods;
  const standardPeriodTax = calcPeriodWithholding(regularPeriodGross, payPeriods, hasHecs);
  const combinedPeriodGross = regularPeriodGross + bonusPerPeriod;
  const combinedPeriodTax = calcPeriodWithholding(combinedPeriodGross, payPeriods, hasHecs);
  const additionalTaxPerPeriod = Math.max(0, combinedPeriodTax - standardPeriodTax);
  const methodAWithholding = Math.round((additionalTaxPerPeriod * payPeriods) * 100) / 100;

  // 4. Naive Paycheck Marginal Withholding (where single period annualized causes top rate spike)
  const naiveSinglePeriodGross = regularPeriodGross + taxableBonus;
  const naiveSinglePeriodTax = calcPeriodWithholding(naiveSinglePeriodGross, payPeriods, hasHecs);
  const naiveBonusWithholding = Math.round(Math.max(0, naiveSinglePeriodTax - standardPeriodTax) * 100) / 100;

  // 5. True End-of-Year Assessment (July 2027)
  const trueAnnualTaxBase = calcTotalAuAnnualTax(regularAnnualSalary, hasHecs);
  const trueAnnualTaxWithBonus = calcTotalAuAnnualTax(regularAnnualSalary + taxableBonus, hasHecs);
  const trueMarginalTaxOnBonus = Math.round((trueAnnualTaxWithBonus - trueAnnualTaxBase) * 100) / 100;

  // 6. Reconciliation (Tax Return Refund)
  const methodAOverWithholding = Math.round((methodAWithholding - trueMarginalTaxOnBonus) * 100) / 100;
  const naiveOverWithholding = Math.round((naiveBonusWithholding - trueMarginalTaxOnBonus) * 100) / 100;

  // 7. Net Take-Home Cash
  const methodATakeHome = Math.round((bonusAmount - actualSalarySacrifice - methodAWithholding) * 100) / 100;
  const naiveTakeHome = Math.round((bonusAmount - actualSalarySacrifice - naiveBonusWithholding) * 100) / 100;

  // 8. Super Salary Sacrifice Tax Benefit
  // Marginal income tax + 2% Medicare saved vs 15% super contribution tax
  let topMarginalRate = 0.30;
  if (regularAnnualSalary > 190000) topMarginalRate = 0.45;
  else if (regularAnnualSalary > 135000) topMarginalRate = 0.37;
  else if (regularAnnualSalary > 45000) topMarginalRate = 0.30;
  else topMarginalRate = 0.16;

  const marginalSavingsRate = (topMarginalRate + 0.02) - ATO_RATES_2026_27.superContributionsTax;
  const superTaxSavings = Math.round((actualSalarySacrifice * marginalSavingsRate) * 100) / 100;

  return {
    bonusAmount,
    actualSalarySacrifice,
    taxableBonus,
    superGuaranteeAmount: Math.round(superGuaranteeAmount * 100) / 100,
    methodA: {
      withholding: methodAWithholding,
      netTakeHome: methodATakeHome,
      refundInJuly: methodAOverWithholding
    },
    naiveMethod: {
      withholding: naiveBonusWithholding,
      netTakeHome: naiveTakeHome,
      refundInJuly: naiveOverWithholding
    },
    trueTax: {
      marginalTax: trueMarginalTaxOnBonus,
      effectiveRatePct: bonusAmount > 0 ? (trueMarginalTaxOnBonus / bonusAmount) * 100 : 0
    },
    superSavings: {
      actualSacrifice: actualSalarySacrifice,
      taxSaved: superTaxSavings
    }
  };
}
