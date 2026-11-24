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

export function compareErcSwitch(inputs) {
  const {
    currentBalance = 300000,
    currentRate = 0.0565,
    remainingFixMonths = 24,
    remainingTermMonths = 300,
    ercPercentage = 2.0,
    overpaymentAllowancePct = 10.0,
    cashToOverpay = 0,
    newRate = 0.0419,
    newArrangementFee = 999
  } = inputs;

  if (currentBalance <= 0 || isNaN(currentBalance)) throw new RangeError('Balance must be positive');
  if (currentRate < 0 || isNaN(currentRate) || newRate < 0 || isNaN(newRate)) throw new RangeError('Rates cannot be negative');
  if (remainingFixMonths <= 0 || isNaN(remainingFixMonths)) throw new RangeError('Remaining fix months must be positive');
  if (remainingTermMonths <= 0 || isNaN(remainingTermMonths)) throw new RangeError('Remaining term must be positive');
  if (ercPercentage < 0 || isNaN(ercPercentage)) throw new RangeError('ERC percentage cannot be negative');

  // Overpayment optimization
  const maxPenaltyFreeOverpayment = (overpaymentAllowancePct / 100) * currentBalance;
  const actualOverpayment = Math.min(Math.max(0, cashToOverpay), maxPenaltyFreeOverpayment);
  const balanceSubjectToErc = Math.max(0, currentBalance - actualOverpayment);

  // ERC Calculation
  const ercChargeAmount = balanceSubjectToErc * (ercPercentage / 100);
  const totalSwitchingCosts = ercChargeAmount + newArrangementFee;

  // Scenario 1: Stay on Current Deal
  const effectivePrincipal = balanceSubjectToErc;
  const pmtCurrent = calcMonthlyPayment(effectivePrincipal, currentRate, remainingTermMonths);
  const totalPaidCurrent = pmtCurrent * remainingFixMonths;
  const endBalanceCurrent = calcRemainingBalance(effectivePrincipal, currentRate, remainingTermMonths, remainingFixMonths);
  const trueCostCurrent = totalPaidCurrent + (endBalanceCurrent - effectivePrincipal);

  // Scenario 2: Switch Early to New Deal
  const pmtNew = calcMonthlyPayment(effectivePrincipal, newRate, remainingTermMonths);
  const totalPaidNew = pmtNew * remainingFixMonths;
  const endBalanceNew = calcRemainingBalance(effectivePrincipal, newRate, remainingTermMonths, remainingFixMonths);
  const trueCostNew = totalPaidNew + totalSwitchingCosts + (endBalanceNew - effectivePrincipal);

  const monthlyPaymentSavings = pmtCurrent - pmtNew;
  const totalPaymentsSaved = totalPaidCurrent - totalPaidNew;
  const capitalBalanceAdvantage = endBalanceCurrent - endBalanceNew;
  const netSwitchingAdvantage = trueCostCurrent - trueCostNew;
  const isSwitchProfitable = netSwitchingAdvantage > 0;

  // Breakeven new interest rate search
  let lowRate = 0.005, highRate = currentRate;
  for (let i = 0; i < 40; i++) {
    const midRate = (lowRate + highRate) / 2;
    const pmtTest = calcMonthlyPayment(effectivePrincipal, midRate, remainingTermMonths);
    const endBalTest = calcRemainingBalance(effectivePrincipal, midRate, remainingTermMonths, remainingFixMonths);
    const costTest = (pmtTest * remainingFixMonths) + totalSwitchingCosts + (endBalTest - effectivePrincipal);
    if (costTest < trueCostCurrent) {
      lowRate = midRate;
    } else {
      highRate = midRate;
    }
  }
  const breakevenNewRate = (lowRate + highRate) / 2;

  return {
    currentBalance,
    currentRate,
    remainingFixMonths,
    remainingTermMonths,
    ercPercentage,
    maxPenaltyFreeOverpayment,
    actualOverpayment,
    balanceSubjectToErc,
    ercChargeAmount,
    newArrangementFee,
    totalSwitchingCosts,
    currentDeal: {
      monthlyPayment: pmtCurrent,
      totalPaidOverFix: totalPaidCurrent,
      endingBalance: endBalanceCurrent,
      trueCost: trueCostCurrent
    },
    newDeal: {
      newRate,
      monthlyPayment: pmtNew,
      totalPaidOverFix: totalPaidNew,
      endingBalance: endBalanceNew,
      trueCost: trueCostNew
    },
    monthlyPaymentSavings,
    totalPaymentsSaved,
    capitalBalanceAdvantage,
    netSwitchingAdvantage,
    isSwitchProfitable,
    breakevenNewRate
  };
}
