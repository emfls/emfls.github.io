export function calcMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const rm = annualRate / 12;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function calcRemainingBalance(principal, annualRate, totalMonths, elapsedMonths) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return Math.max(0, principal * (1 - elapsedMonths / totalMonths));
  const rm = annualRate / 12;
  const pmt = calcMonthlyPayment(principal, annualRate, totalMonths);
  const balance = principal * Math.pow(1 + rm, elapsedMonths) - pmt * (Math.pow(1 + rm, elapsedMonths) - 1) / rm;
  return Math.max(0, balance);
}

export function compareRemortgageDeals(inputs) {
  const {
    balance = 250000,
    termYears = 25,
    fixedYears = 2,
    feeDeal = { fee: 999, rate: 0.0424, addFeeToBalance: true, cashback: 0 },
    feeFreeDeal = { fee: 0, rate: 0.0464, cashback: 0 }
  } = inputs;

  if (balance <= 0 || isNaN(balance)) throw new RangeError('Balance must be positive');
  if (termYears <= 0 || isNaN(termYears)) throw new RangeError('Term must be positive');
  if (fixedYears <= 0 || isNaN(fixedYears)) throw new RangeError('Fixed period must be positive');
  if (feeDeal.fee < 0 || isNaN(feeDeal.fee)) throw new RangeError('Fee cannot be negative');
  if (feeDeal.rate < 0 || isNaN(feeDeal.rate) || feeFreeDeal.rate < 0 || isNaN(feeFreeDeal.rate)) throw new RangeError('Rates cannot be negative');

  const totalMonths = termYears * 12;
  const fixMonths = fixedYears * 12;

  // Deal A: With Fee
  const initialPrincipalA = feeDeal.addFeeToBalance ? (balance + feeDeal.fee) : balance;
  const upfrontFeeA = feeDeal.addFeeToBalance ? 0 : feeDeal.fee;
  const pmtA = calcMonthlyPayment(initialPrincipalA, feeDeal.rate, totalMonths);
  const endBalanceA = calcRemainingBalance(initialPrincipalA, feeDeal.rate, totalMonths, fixMonths);
  const totalPaidA = (pmtA * fixMonths) + upfrontFeeA - (feeDeal.cashback || 0);
  const trueCostA = totalPaidA + (endBalanceA - balance);

  // Deal B: Fee-Free
  const initialPrincipalB = balance;
  const pmtB = calcMonthlyPayment(initialPrincipalB, feeFreeDeal.rate, totalMonths);
  const endBalanceB = calcRemainingBalance(initialPrincipalB, feeFreeDeal.rate, totalMonths, fixMonths);
  const totalPaidB = (pmtB * fixMonths) - (feeFreeDeal.cashback || 0);
  const trueCostB = totalPaidB + (endBalanceB - balance);

  const monthlySavingsA = pmtB - pmtA; // positive means Deal A has lower monthly payment
  const netSavingsA = trueCostB - trueCostA; // positive means Deal A is cheaper overall
  const betterDeal = netSavingsA >= 0 ? 'fee' : 'fee-free';

  // Breakeven balance binary search
  let low = 10000, high = 2000000;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const pA = feeDeal.addFeeToBalance ? (mid + feeDeal.fee) : mid;
    const upA = feeDeal.addFeeToBalance ? 0 : feeDeal.fee;
    const payA = calcMonthlyPayment(pA, feeDeal.rate, totalMonths);
    const endA = calcRemainingBalance(pA, feeDeal.rate, totalMonths, fixMonths);
    const costA = (payA * fixMonths) + upA - (feeDeal.cashback || 0) + (endA - mid);

    const payB = calcMonthlyPayment(mid, feeFreeDeal.rate, totalMonths);
    const endB = calcRemainingBalance(mid, feeFreeDeal.rate, totalMonths, fixMonths);
    const costB = (payB * fixMonths) - (feeFreeDeal.cashback || 0) + (endB - mid);

    if (costA < costB) {
      high = mid;
    } else {
      low = mid;
    }
  }
  const breakevenBalance = Math.round((low + high) / 2);

  return {
    balance,
    termYears,
    fixedYears,
    dealA: {
      fee: feeDeal.fee,
      rate: feeDeal.rate,
      addFeeToBalance: feeDeal.addFeeToBalance,
      monthlyPayment: pmtA,
      totalPaymentsOverFix: pmtA * fixMonths,
      endingBalance: endBalanceA,
      totalPaidOverFix: totalPaidA,
      trueCostOverFix: trueCostA
    },
    dealB: {
      rate: feeFreeDeal.rate,
      cashback: feeFreeDeal.cashback || 0,
      monthlyPayment: pmtB,
      totalPaymentsOverFix: pmtB * fixMonths,
      endingBalance: endBalanceB,
      totalPaidOverFix: totalPaidB,
      trueCostOverFix: trueCostB
    },
    monthlySavingsWithFee: monthlySavingsA,
    netSavingsWithFee: netSavingsA,
    betterDeal,
    breakevenBalance
  };
}
