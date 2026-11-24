// UK Equity Release Lifetime Mortgage Calculator (Equity Release Council 2026/27 Standards)
export function calcAERCompound(principal, aer, years) {
  if (years <= 0) return principal;
  return principal * Math.pow(1 + aer, years);
}

export function calcDoublingRule72(aer) {
  if (aer <= 0) return Infinity;
  return Math.log(2) / Math.log(1 + aer);
}

export function computeEquityRelease(inputs) {
  const {
    propertyValue = 450000,
    initialRelease = 100000,
    interestRateAER = 0.061,
    propertyGrowthRate = 0.03,
    voluntaryInterestPct = 1.0 // 1.0 = 100% interest serviced, 0.0 = full roll-up
  } = inputs;

  if (initialRelease <= 0 || isNaN(initialRelease)) throw new RangeError('Initial release must be positive');
  if (propertyValue <= 0 || isNaN(propertyValue)) throw new RangeError('Property value must be positive');
  if (initialRelease > propertyValue) throw new RangeError('Initial release cannot exceed property value');

  const monthlyInterestCost100Pct = (initialRelease * interestRateAER) / 12;
  const doublingYears = calcDoublingRule72(interestRateAER);

  const projections = [];
  for (let yr = 0; yr <= 25; yr++) {
    const propVal = propertyValue * Math.pow(1 + propertyGrowthRate, yr);
    const rollupDebt = calcAERCompound(initialRelease, interestRateAER, yr);

    // Serviced debt calculation: voluntary payments reduce accrued interest
    // If voluntaryInterestPct == 1.0, debt stays at initialRelease
    // If voluntaryInterestPct == 0.0, debt is rollupDebt
    // Partial payment compounds unserviced portion
    let servicedDebt = initialRelease;
    if (voluntaryInterestPct < 1.0) {
      const unservicedRate = interestRateAER * (1 - voluntaryInterestPct);
      servicedDebt = calcAERCompound(initialRelease, unservicedRate, yr);
    }

    // Equity Release Council 'No Negative Equity' Guarantee
    const rollupInheritance = Math.max(0, propVal - rollupDebt);
    const servicedInheritance = Math.max(0, propVal - servicedDebt);
    const equitySavedVsRollup = rollupDebt - servicedDebt;

    projections.push({
      year: yr,
      propertyValue: propVal,
      rollupDebt,
      rollupInheritance,
      servicedDebt,
      servicedInheritance,
      equitySavedVsRollup,
      noNegativeEquityClauseInvoked: rollupDebt > propVal
    });
  }

  return {
    propertyValue,
    initialRelease,
    interestRateAER,
    propertyGrowthRate,
    voluntaryInterestPct,
    monthlyInterestCost100Pct,
    doublingYears,
    projections
  };
}
