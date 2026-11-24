// AU Life Insurance Inside vs Outside Super Engine (ITAA 1997 & 2026/27 Rules)
export function calcInsideSuperPremium(retailPremium) {
  // Super funds claim 15% tax deduction on group life premiums, passing savings to member
  return retailPremium * 0.85;
}

export function calcRetailPretaxSalary(retailPremium, marginalTaxRate) {
  if (marginalTaxRate >= 1.0) return retailPremium;
  return retailPremium / (1 - marginalTaxRate);
}

export function calcDeathTaxLiability(coverAmount, beneficiaryType, taxElement = 'taxed') {
  // ATO Dependant (Spouse, Child < 18, Financial Dependant): 0% Tax
  // Non-Dependant (Adult Child 18+):
  //   - Taxed element: 15% + 2% Medicare = 17%
  //   - Untaxed element: 30% + 2% Medicare = 32%
  if (beneficiaryType === 'spouse' || beneficiaryType === 'child_under_18' || beneficiaryType === 'financial_dependant') {
    return { deathTaxRate: 0, deathTaxPayable: 0, netPayout: coverAmount };
  }

  const rate = taxElement === 'untaxed' ? 0.32 : 0.17;
  const taxPayable = coverAmount * rate;
  return { deathTaxRate: rate, deathTaxPayable: taxPayable, netPayout: coverAmount - taxPayable };
}

export function calcSuperBalanceDrag(annualSuperCost, years = 20, superReturnRate = 0.07) {
  // Future value of premiums deducted from super compounding at 7% net p.a.
  let fv = 0;
  for (let yr = 1; yr <= years; yr++) {
    fv = (fv + annualSuperCost) * (1 + superReturnRate);
  }
  return fv;
}

export function calcSteppedVsLevel(initialPremium, years = 20) {
  // Stepped increases ~8% per year with age
  // Level premium is ~1.8x initial stepped but stays constant
  const levelPremium = initialPremium * 1.8;
  const steppedPremiums = [];
  let totalStepped = 0;
  let totalLevel = 0;
  let crossoverYear = null;

  for (let yr = 1; yr <= years; yr++) {
    const stepped = initialPremium * Math.pow(1.08, yr - 1);
    steppedPremiums.push(stepped);
    totalStepped += stepped;
    totalLevel += levelPremium;

    if (crossoverYear === null && stepped > levelPremium) {
      crossoverYear = yr;
    }
  }

  return {
    levelPremium,
    steppedPremiums,
    totalSteppedCost: totalStepped,
    totalLevelCost: totalLevel,
    crossoverYear: crossoverYear || 8,
    totalLevelSavings: Math.max(0, totalStepped - totalLevel)
  };
}

export function computeAULifeInsurance(inputs) {
  const {
    coverAmount = 1000000,
    annualPremiumRetail = 1200,
    marginalTaxRate = 0.32, // 30% tax bracket + 2% Medicare levy
    beneficiaryType = 'adult_child',
    taxElement = 'taxed'
  } = inputs;

  if (coverAmount <= 0 || isNaN(coverAmount)) throw new RangeError('Cover amount must be positive');
  if (annualPremiumRetail <= 0 || isNaN(annualPremiumRetail)) throw new RangeError('Annual premium must be positive');
  if (marginalTaxRate < 0 || marginalTaxRate > 0.50) throw new RangeError('Invalid marginal tax rate');

  const insideSuperNetCost = calcInsideSuperPremium(annualPremiumRetail);
  const retailPretaxSalaryRequired = calcRetailPretaxSalary(annualPremiumRetail, marginalTaxRate);
  const annualCashSavingsToday = retailPretaxSalaryRequired - insideSuperNetCost;

  const deathTaxInside = calcDeathTaxLiability(coverAmount, beneficiaryType, taxElement);
  const deathTaxOutside = { deathTaxRate: 0, deathTaxPayable: 0, netPayout: coverAmount }; // Outside super life insurance is 100% tax-free

  const superBalanceDrag = calcSuperBalanceDrag(insideSuperNetCost, 20, 0.07);
  const steppedVsLevel = calcSteppedVsLevel(annualPremiumRetail, 20);

  return {
    coverAmount,
    annualPremiumRetail,
    insideSuperNetCost,
    retailPretaxSalaryRequired,
    annualCashSavingsToday,
    superDeathTaxPayable: deathTaxInside.deathTaxPayable,
    deathTaxRate: deathTaxInside.deathTaxRate,
    superNetPayout: deathTaxInside.netPayout,
    retailNetPayout: deathTaxOutside.netPayout,
    deathTaxLossDollars: deathTaxInside.deathTaxPayable,
    superBalanceDrag,
    crossoverYear: steppedVsLevel.crossoverYear,
    levelTotalSavings20Yr: steppedVsLevel.totalLevelSavings
  };
}
