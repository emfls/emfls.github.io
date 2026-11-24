export function calcCanadianMonthlyRate(annualRate) {
  if (annualRate <= 0 || isNaN(annualRate)) return 0;
  return Math.pow(1 + annualRate / 2, 1 / 6) - 1;
}

export function calcCanadianMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0 || isNaN(principal)) return 0;
  if (annualRate <= 0 || isNaN(annualRate)) return principal / months;
  const rm = calcCanadianMonthlyRate(annualRate);
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function calcOsfiStressRate(contractRate) {
  return Math.max(0.0525, contractRate + 0.02);
}

export function calcHelocReadvanceable(inputs) {
  const {
    homeValue = 850000,
    mortgageBalance = 510000,
    mortgageRate = 0.0489,
    amortizationYears = 25,
    helocRate = 0.0695,
    currentHelocBalance = 0
  } = inputs;

  if (homeValue <= 0 || isNaN(homeValue)) throw new RangeError('Home value must be positive');
  if (mortgageBalance < 0 || isNaN(mortgageBalance)) throw new RangeError('Mortgage balance cannot be negative');
  if (mortgageRate < 0 || isNaN(mortgageRate)) throw new RangeError('Mortgage rate cannot be negative');
  if (amortizationYears <= 0 || isNaN(amortizationYears)) throw new RangeError('Amortization years must be positive');

  const totalMonths = amortizationYears * 12;
  const maxCombinedBorrowing = homeValue * 0.80; // OSFI 80% Combined LTV cap
  const maxHelocCap = homeValue * 0.65;         // OSFI 65% Revolving HELOC cap

  const currentMortgageLtv = (mortgageBalance / homeValue) * 100;
  const currentCombinedLtv = ((mortgageBalance + currentHelocBalance) / homeValue) * 100;

  // Initial HELOC capacity
  const combinedRoom = Math.max(0, maxCombinedBorrowing - mortgageBalance);
  const initialHelocLimit = Math.min(maxHelocCap, combinedRoom);
  const availableHelocNow = Math.max(0, initialHelocLimit - currentHelocBalance);

  // Mortgage monthly payment with statutory Interest Act semi-annual compounding
  const monthlyPayment = calcCanadianMonthlyPayment(mortgageBalance, mortgageRate, totalMonths);

  // OSFI Stress test
  const stressRate = calcOsfiStressRate(mortgageRate);
  const stressMonthlyPayment = calcCanadianMonthlyPayment(mortgageBalance, stressRate, totalMonths);
  const stressBufferAmount = stressMonthlyPayment - monthlyPayment;

  // 5-Year Month-by-Month Amortization & Readvanceable HELOC Tracking (60 months)
  const rm = calcCanadianMonthlyRate(mortgageRate);
  let balance = mortgageBalance;
  let cumulativePrincipal = 0;
  let crossesBelow65Month = null;

  const milestones = [];
  const schedule60 = [];

  for (let m = 1; m <= 60; m++) {
    const interest = balance * rm;
    const principalPaid = Math.min(balance, monthlyPayment - interest);
    balance = Math.max(0, balance - principalPaid);
    cumulativePrincipal += principalPaid;

    const currentLtv_m = (balance / homeValue) * 100;
    if (crossesBelow65Month === null && currentLtv_m <= 65.0) {
      crossesBelow65Month = m;
    }

    const availableCombined_m = Math.max(0, maxCombinedBorrowing - balance);
    const helocLimit_m = Math.min(maxHelocCap, availableCombined_m);
    const helocExpansion_m = helocLimit_m - initialHelocLimit;

    schedule60.push({
      month: m,
      balance,
      principalPaid,
      cumulativePrincipal,
      ltv: currentLtv_m,
      helocLimit: helocLimit_m,
      helocExpansion: helocExpansion_m
    });

    if (m === 12 || m === 24 || m === 36 || m === 48 || m === 60) {
      milestones.push({
        year: m / 12,
        balance,
        cumulativePrincipal,
        ltv: currentLtv_m,
        helocLimit: helocLimit_m,
        helocExpansion: helocExpansion_m
      });
    }
  }

  const year5 = milestones[milestones.length - 1];

  return {
    homeValue,
    mortgageBalance,
    mortgageRate,
    amortizationYears,
    helocRate,
    currentHelocBalance,
    osfi: {
      maxCombinedBorrowing,
      maxHelocCap,
      currentMortgageLtv,
      currentCombinedLtv,
      initialHelocLimit,
      availableHelocNow,
      isAtHelocMax: initialHelocLimit >= maxHelocCap
    },
    payments: {
      monthlyPayment,
      stressRate,
      stressMonthlyPayment,
      stressBufferAmount
    },
    readvanceable: {
      crossesBelow65Month,
      cumulative5YrPrincipal: year5 ? year5.cumulativePrincipal : 0,
      fiveYearHelocLimit: year5 ? year5.helocLimit : 0,
      fiveYearHelocExpansion: year5 ? year5.helocExpansion : 0,
      milestones
    },
    schedule60
  };
}
