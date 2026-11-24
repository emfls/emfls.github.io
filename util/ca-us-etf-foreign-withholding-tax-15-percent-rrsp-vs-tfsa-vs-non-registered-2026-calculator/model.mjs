export const TREATY_RATE = 0.15;
export const LOSS_YEARS = 25;
export const FX_YEARS = 20;

export function calculateWithholding({
  amount, dividendYieldPct, totalReturnPct, creditRecoveryPct, retailFxPct, gambitCost
}) {
  const ranges = [
    [amount, 0.01, 100_000_000],
    [dividendYieldPct, 0, 100],
    [totalReturnPct, -80, 50],
    [creditRecoveryPct, 0, 100],
    [retailFxPct, 0, 100],
    [gambitCost, 0, 100_000_000]
  ];
  if (ranges.some(([value, min, max]) => !Number.isFinite(value) || value < min || value > max)) {
    throw new RangeError('Every input must be within its displayed range.');
  }

  const grossFactor = 1 + totalReturnPct / 100;
  const grossDragPct = dividendYieldPct * TREATY_RATE;
  const grossDrag = grossDragPct / 100;
  const recovery = creditRecoveryPct / 100;
  const noWithholdingWealth = amount * grossFactor ** LOSS_YEARS;

  function scenario(withheldDragPct, unrecoveredShare) {
    const annualFwtDragPct = withheldDragPct * unrecoveredShare;
    return {
      annualFwtDragPct,
      firstYearWithheld: amount * (withheldDragPct / 100),
      firstYearLost: amount * (annualFwtDragPct / 100),
      wealthLost: noWithholdingWealth * -Math.expm1(
        LOSS_YEARS * Math.log1p(-annualFwtDragPct / 100 / grossFactor)
      )
    };
  }

  const rrspDirect = scenario(0, 1);
  const rrspWrapper = scenario(grossDragPct, 1);
  const otherRegistered = scenario(grossDragPct, 1);
  const taxable = scenario(grossDragPct, 1 - recovery);
  const logGrowthAdvantage = -Math.log1p(-grossDrag / grossFactor);
  const wrapperWealthAt20 = amount * (grossFactor - grossDrag) ** FX_YEARS;

  function conversion(cost, costShare) {
    if (costShare >= 1) {
      return {
        cost,
        breakEvenYears: null,
        netSavingsAt20: costShare === 1 ? -wrapperWealthAt20 : null
      };
    }
    const logInitialShare = Math.log1p(-costShare);
    let breakEvenYears = null;
    if (costShare === 0) breakEvenYears = 0;
    else if (logGrowthAdvantage > 0) breakEvenYears = -logInitialShare / logGrowthAdvantage;
    return {
      cost,
      breakEvenYears,
      netSavingsAt20: wrapperWealthAt20 * Math.expm1(logInitialShare + FX_YEARS * logGrowthAdvantage)
    };
  }

  return {
    rrspDirect, rrspWrapper, otherRegistered, taxable,
    rrspSwitchGrossSavings: rrspWrapper.wealthLost,
    retail: conversion(amount * (retailFxPct / 100), retailFxPct / 100),
    gambit: conversion(gambitCost, gambitCost / amount)
  };
}
