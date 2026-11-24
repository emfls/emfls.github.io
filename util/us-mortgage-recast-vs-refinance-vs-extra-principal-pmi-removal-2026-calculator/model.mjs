export function calcMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const rm = annualRate / 12;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function compareRecastOptions(inputs) {
  const {
    currentBalance = 380000,
    homeValue = 450000,
    noteRate = 0.0575,
    remainingMonths = 300,
    lumpSum = 50000,
    monthlyPmi = 185,
    recastFee = 300,
    refiRate = 0.0625,
    refiCosts = 5000,
    refiTermMonths = 300
  } = inputs;

  if (currentBalance <= 0 || isNaN(currentBalance)) throw new RangeError('Balance must be positive');
  if (homeValue <= 0 || isNaN(homeValue)) throw new RangeError('Home value must be positive');
  if (noteRate < 0 || isNaN(noteRate)) throw new RangeError('Rate cannot be negative');
  if (remainingMonths <= 0 || isNaN(remainingMonths)) throw new RangeError('Remaining months must be positive');
  if (lumpSum < 0 || isNaN(lumpSum)) throw new RangeError('Lump sum cannot be negative');

  const currentLtv = (currentBalance / homeValue) * 100;
  const isPmiActive = currentLtv > 80.0 && monthlyPmi > 0;
  const activePmiAmount = isPmiActive ? monthlyPmi : 0;

  // Baseline standard loan
  const baseMonthlyPi = calcMonthlyPayment(currentBalance, noteRate, remainingMonths);
  const baseTotalPayment = baseMonthlyPi + activePmiAmount;
  const baseTotalInterest = (baseMonthlyPi * remainingMonths) - currentBalance;

  // Strategy A: Mortgage Recast
  const recastPrincipal = Math.max(0, currentBalance - lumpSum);
  const recastLtv = (recastPrincipal / homeValue) * 100;
  const isPmiRemovedRecast = recastLtv <= 80.0;
  const recastMonthlyPmi = isPmiRemovedRecast ? 0 : activePmiAmount;
  const recastMonthlyPi = calcMonthlyPayment(recastPrincipal, noteRate, remainingMonths);
  const recastTotalMonthly = recastMonthlyPi + recastMonthlyPmi;

  const monthlyPiSavings = baseMonthlyPi - recastMonthlyPi;
  const monthlyPmiSavings = activePmiAmount - recastMonthlyPmi;
  const totalMonthlySavings = baseTotalPayment - recastTotalMonthly;
  const recastTotalInterest = (recastMonthlyPi * remainingMonths) - recastPrincipal;
  const recastLifetimeInterestSaved = baseTotalInterest - recastTotalInterest;
  const recastPaybackMonths = totalMonthlySavings > 0 ? (recastFee / totalMonthlySavings) : 0;

  // Strategy B: Extra Principal Curtailment
  // Same $50k down, keep paying baseMonthlyPi, PMI removed if LTV <= 80%
  const isPmiRemovedCurtail = recastLtv <= 80.0;
  const rm = noteRate / 12;
  let curtailMonths = remainingMonths;
  if (recastPrincipal > 0 && rm > 0) {
    curtailMonths = Math.ceil(-Math.log(1 - (recastPrincipal * rm) / baseMonthlyPi) / Math.log(1 + rm));
  }
  const monthsShavedOff = remainingMonths - curtailMonths;
  const curtailTotalInterest = (baseMonthlyPi * curtailMonths) - recastPrincipal;
  const curtailLifetimeInterestSaved = baseTotalInterest - curtailTotalInterest;

  // Strategy C: Refinance
  const refiPrincipal = recastPrincipal + refiCosts;
  const refiLtv = (refiPrincipal / homeValue) * 100;
  const isPmiRemovedRefi = refiLtv <= 80.0;
  const refiMonthlyPmi = isPmiRemovedRefi ? 0 : activePmiAmount;
  const refiMonthlyPi = calcMonthlyPayment(refiPrincipal, refiRate, refiTermMonths);
  const refiTotalMonthly = refiMonthlyPi + refiMonthlyPmi;
  const refiMonthlySavings = baseTotalPayment - refiTotalMonthly;
  const refiTotalInterest = (refiMonthlyPi * refiTermMonths) - refiPrincipal;

  return {
    currentBalance,
    homeValue,
    currentLtv,
    noteRate,
    remainingMonths,
    lumpSum,
    monthlyPmi: activePmiAmount,
    base: {
      monthlyPi: baseMonthlyPi,
      totalMonthly: baseTotalPayment,
      totalInterest: baseTotalInterest
    },
    recast: {
      newPrincipal: recastPrincipal,
      newLtv: recastLtv,
      pmiRemoved: isPmiRemovedRecast,
      monthlyPi: recastMonthlyPi,
      totalMonthly: recastTotalMonthly,
      monthlyPiSavings,
      monthlyPmiSavings,
      totalMonthlySavings,
      totalInterest: recastTotalInterest,
      lifetimeInterestSaved: recastLifetimeInterestSaved,
      paybackMonths: recastPaybackMonths,
      recastFee
    },
    curtailment: {
      newPrincipal: recastPrincipal,
      monthlyPayment: baseMonthlyPi,
      curtailMonths,
      monthsShavedOff,
      totalInterest: curtailTotalInterest,
      lifetimeInterestSaved: curtailLifetimeInterestSaved,
      pmiRemoved: isPmiRemovedCurtail
    },
    refinance: {
      newPrincipal: refiPrincipal,
      refiRate,
      monthlyPi: refiMonthlyPi,
      totalMonthly: refiTotalMonthly,
      monthlySavings: refiMonthlySavings,
      closingCosts: refiCosts,
      totalInterest: refiTotalInterest
    }
  };
}
