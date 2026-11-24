// Statutory Canadian Interest Act Section 6 Compounding
export function getCanadianEffectiveMonthlyRate(nominalRateAnnual) {
  if (nominalRateAnnual <= 0) return 0;
  // Effective monthly rate: (1 + r_nom / 2)^(1/6) - 1
  return Math.pow(1 + nominalRateAnnual / 2, 1 / 6) - 1;
}

export function calcCanadianMonthlyPayment(principal, nominalRateAnnual, totalMonths) {
  if (principal <= 0) return 0;
  if (nominalRateAnnual <= 0) return principal / totalMonths;
  const rm = getCanadianEffectiveMonthlyRate(nominalRateAnnual);
  return principal * (rm / (1 - Math.pow(1 + rm, -totalMonths)));
}

export function calcCanadianMortgageShock(inputs) {
  const {
    renewalBalance = 450000,
    remainingAmortYears = 20,
    currentRate = 0.0219,
    bankRenewalRate = 0.0489,
    competitorRate = 0.0459,
    lumpSumPrepayment = 25000,
    extendedAmortYears = 25
  } = inputs;

  if (renewalBalance <= 0 || isNaN(renewalBalance)) throw new RangeError('Balance must be positive');
  if (remainingAmortYears <= 0 || remainingAmortYears > 35 || isNaN(remainingAmortYears)) throw new RangeError('Amortization must be between 1 and 35 years');
  if (currentRate < 0 || isNaN(currentRate) || bankRenewalRate < 0 || isNaN(bankRenewalRate)) throw new RangeError('Rates cannot be negative');

  const baseMonths = remainingAmortYears * 12;

  // 1. Current Expiring Payment
  const currentPayment = calcCanadianMonthlyPayment(renewalBalance, currentRate, baseMonths);

  // 2. Status Quo Bank Renewal Offer
  const bankRenewalPayment = calcCanadianMonthlyPayment(renewalBalance, bankRenewalRate, baseMonths);
  const paymentShockDollars = bankRenewalPayment - currentPayment;
  const paymentShockPct = currentPayment > 0 ? (paymentShockDollars / currentPayment) * 100 : 0;

  // 3. OSFI Straight-Switch Competitor
  const competitorPayment = calcCanadianMonthlyPayment(renewalBalance, competitorRate, baseMonths);
  const monthlySwitchSavings = bankRenewalPayment - competitorPayment;
  const termSwitchSavings5Yr = monthlySwitchSavings * 60;

  // 4. Lump Sum Prepayment Option
  const prepaidBalance = Math.max(0, renewalBalance - lumpSumPrepayment);
  const prepaidPayment = calcCanadianMonthlyPayment(prepaidBalance, bankRenewalRate, baseMonths);
  const prepaidMonthlySavings = bankRenewalPayment - prepaidPayment;

  // 5. Extended Amortization Option
  const extMonths = extendedAmortYears * 12;
  const extendedPayment = calcCanadianMonthlyPayment(renewalBalance, bankRenewalRate, extMonths);
  const extendedPaymentShockDollars = extendedPayment - currentPayment;
  const extendedPaymentShockPct = currentPayment > 0 ? (extendedPaymentShockDollars / currentPayment) * 100 : 0;

  // Total Lifetime Interest Comparison
  const totalPaidBank = bankRenewalPayment * baseMonths;
  const totalInterestBank = totalPaidBank - renewalBalance;
  const totalPaidExtended = extendedPayment * extMonths;
  const totalInterestExtended = totalPaidExtended - renewalBalance;
  const extraLifetimeInterestFromExtension = totalInterestExtended - totalInterestBank;

  return {
    renewalBalance,
    remainingAmortYears,
    currentRate,
    bankRenewalRate,
    competitorRate,
    currentPayment,
    statusQuo: {
      monthlyPayment: bankRenewalPayment,
      paymentShockDollars,
      paymentShockPct,
      total5YrPaid: bankRenewalPayment * 60,
      totalLifetimeInterest: totalInterestBank
    },
    osfiSwitch: {
      competitorRate,
      monthlyPayment: competitorPayment,
      monthlySavingsVsBank: monthlySwitchSavings,
      savings5Yr: termSwitchSavings5Yr
    },
    prepayment: {
      prepayAmount: lumpSumPrepayment,
      newBalance: prepaidBalance,
      monthlyPayment: prepaidPayment,
      monthlySavingsVsStatusQuo: prepaidMonthlySavings
    },
    amortExtension: {
      extendedYears: extendedAmortYears,
      monthlyPayment: extendedPayment,
      monthlyPaymentShockDollars: extendedPaymentShockDollars,
      monthlyPaymentShockPct: extendedPaymentShockPct,
      extraLifetimeInterest: extraLifetimeInterestFromExtension
    }
  };
}
