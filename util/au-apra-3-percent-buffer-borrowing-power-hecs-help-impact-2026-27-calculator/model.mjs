export function calcStage3Tax(taxableIncome) {
  if (taxableIncome <= 0 || isNaN(taxableIncome)) return 0;
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

export function calcMedicareLevy(taxableIncome) {
  if (taxableIncome <= 26000 || isNaN(taxableIncome)) return 0;
  return taxableIncome * 0.02;
}

export function calcHecsRepayment(repaymentIncome, balance = Infinity) {
  if (repaymentIncome <= 69528 || balance <= 0 || isNaN(repaymentIncome)) return 0;
  let repayment = 0;
  if (repaymentIncome <= 129717) {
    repayment = (repaymentIncome - 69528) * 0.15;
  } else if (repaymentIncome <= 186050) {
    repayment = 9028 + (repaymentIncome - 129717) * 0.17;
  } else {
    repayment = repaymentIncome * 0.10;
  }
  return Math.min(balance, Math.max(0, repayment));
}

export function calcMaxBorrowingPower(netMonthlyServiceCapacity, assessmentRate, termYears = 30) {
  if (netMonthlyServiceCapacity <= 0 || isNaN(netMonthlyServiceCapacity)) return 0;
  const months = termYears * 12;
  if (assessmentRate <= 0) return netMonthlyServiceCapacity * months;
  const rm = assessmentRate / 12;
  return netMonthlyServiceCapacity * (Math.pow(1 + rm, months) - 1) / (rm * Math.pow(1 + rm, months));
}

export function calcMonthlyAmortization(principal, annualRate, termYears = 30) {
  if (principal <= 0 || isNaN(principal)) return 0;
  const months = termYears * 12;
  if (annualRate <= 0) return principal / months;
  const rm = annualRate / 12;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function evaluateApraBorrowing(inputs) {
  const {
    grossAnnualIncome = 125000,
    contractRate = 0.0595,
    apraBufferRate = 0.0300,
    loanTermYears = 30,
    hecsHelpBalance = 35000,
    creditCardLimit = 15000,
    monthlyLivingExpenses = 2500,
    otherMonthlyDebt = 0
  } = inputs;

  if (grossAnnualIncome <= 0 || isNaN(grossAnnualIncome)) throw new RangeError('Gross income must be positive');
  if (contractRate < 0 || isNaN(contractRate)) throw new RangeError('Contract rate cannot be negative');
  if (apraBufferRate < 0 || isNaN(apraBufferRate)) throw new RangeError('APRA buffer cannot be negative');
  if (loanTermYears <= 0 || isNaN(loanTermYears)) throw new RangeError('Loan term must be positive');

  const assessmentRate = contractRate + apraBufferRate;
  const tax = calcStage3Tax(grossAnnualIncome);
  const medicare = calcMedicareLevy(grossAnnualIncome);

  function evalScenario(hecsBal, ccLim) {
    const hecsAnnual = calcHecsRepayment(grossAnnualIncome, hecsBal);
    const netAnnual = Math.max(0, grossAnnualIncome - tax - medicare - hecsAnnual);
    const netMonthly = netAnnual / 12;
    const ccMonthlyLiability = Math.max(0, ccLim * 0.038);
    const totalMonthlyLiabilities = monthlyLivingExpenses + ccMonthlyLiability + otherMonthlyDebt;
    const serviceCapacity = Math.max(0, netMonthly - totalMonthlyLiabilities);
    const borrowingPower = calcMaxBorrowingPower(serviceCapacity, assessmentRate, loanTermYears);
    const actualMonthlyRepayment = calcMonthlyAmortization(borrowingPower, contractRate, loanTermYears);
    const assessedMonthlyRepayment = calcMonthlyAmortization(borrowingPower, assessmentRate, loanTermYears);
    const totalDebt = borrowingPower + ccLim + (otherMonthlyDebt * 12 * 5);
    const dti = grossAnnualIncome > 0 ? (borrowingPower + ccLim) / grossAnnualIncome : 0;
    const isHighDti = dti >= 6.0;

    return {
      hecsAnnual,
      hecsMonthly: hecsAnnual / 12,
      netMonthly,
      ccMonthlyLiability,
      totalMonthlyLiabilities,
      serviceCapacity,
      borrowingPower,
      actualMonthlyRepayment,
      assessedMonthlyRepayment,
      dti,
      isHighDti
    };
  }

  const baseline = evalScenario(hecsHelpBalance, creditCardLimit);
  const noHecs = evalScenario(0, creditCardLimit);
  const noCards = evalScenario(hecsHelpBalance, 0);
  const bothCleared = evalScenario(0, 0);

  const hecsUnlockedBorrowing = Math.max(0, noHecs.borrowingPower - baseline.borrowingPower);
  const cardsUnlockedBorrowing = Math.max(0, noCards.borrowingPower - baseline.borrowingPower);
  const bothUnlockedBorrowing = Math.max(0, bothCleared.borrowingPower - baseline.borrowingPower);

  return {
    grossAnnualIncome,
    contractRate,
    apraBufferRate,
    assessmentRate,
    loanTermYears,
    tax,
    medicare,
    monthlyLivingExpenses,
    otherMonthlyDebt,
    baseline,
    noHecs,
    noCards,
    bothCleared,
    deltas: {
      hecsUnlockedBorrowing,
      cardsUnlockedBorrowing,
      bothUnlockedBorrowing
    }
  };
}
