// Canadian Interest Act s.6 Statutory Semi-Annual Compounding Mechanics
// By Canadian federal law, residential mortgages are compounded semi-annually, not in advance.
// Effective rate formulas:
// - Monthly Rate: r_m = Math.pow(1 + r / 2, 1 / 6) - 1
// - Bi-Weekly Rate: r_bw = Math.pow(1 + r / 2, 1 / 13) - 1

export function calcCanadianEffectiveRates(nominalAnnualRate) {
  if (nominalAnnualRate <= 0) return { r_m: 0, r_bw: 0 };
  const r_m = Math.pow(1 + nominalAnnualRate / 2, 1 / 6) - 1;
  const r_bw = Math.pow(1 + nominalAnnualRate / 2, 1 / 13) - 1;
  return { r_m, r_bw };
}

export function calcCanadianMonthlyPayment(principal, nominalAnnualRate, amortizationYears = 25) {
  if (principal <= 0) return 0;
  const { r_m } = calcCanadianEffectiveRates(nominalAnnualRate);
  const totalMonths = amortizationYears * 12;
  if (r_m <= 0) return principal / totalMonths;
  return principal * (r_m / (1 - Math.pow(1 + r_m, -totalMonths)));
}

export function simulateAmortizationSchedule(principal, nominalAnnualRate, scheduleType, baseMonthlyPmt, annualLumpSum = 0) {
  const { r_m, r_bw } = calcCanadianEffectiveRates(nominalAnnualRate);

  let pmt = 0;
  let periodRate = 0;
  let periodsPerYear = 12;

  if (scheduleType === 'monthly') {
    pmt = baseMonthlyPmt;
    periodRate = r_m;
    periodsPerYear = 12;
  } else if (scheduleType === 'regular_biweekly') {
    // Bank regular bi-weekly = monthly * 12 / 26
    pmt = (baseMonthlyPmt * 12) / 26;
    periodRate = r_bw;
    periodsPerYear = 26;
  } else if (scheduleType === 'accelerated_biweekly') {
    // Accelerated bi-weekly = monthly / 2
    pmt = baseMonthlyPmt / 2;
    periodRate = r_bw;
    periodsPerYear = 26;
  }

  let balance = principal;
  let totalInterest = 0;
  let totalPrincipalPaid = 0;
  let period = 0;
  const maxPeriods = 50 * periodsPerYear; // 50 years max safe guard

  let balanceYear5 = 0;
  const balanceAtYears = [];

  while (balance > 0.01 && period < maxPeriods) {
    period++;
    const interest = balance * periodRate;
    totalInterest += interest;

    let principalThisPeriod = pmt - interest;

    // Optional annual lump sum applied at end of each year
    if (annualLumpSum > 0 && period % periodsPerYear === 0) {
      principalThisPeriod += annualLumpSum;
    }

    if (principalThisPeriod > balance) {
      principalThisPeriod = balance;
      balance = 0;
    } else {
      balance -= principalThisPeriod;
    }
    totalPrincipalPaid += principalThisPeriod;

    // Track Year 5 renewal balance (typical Canadian 5-year fixed term)
    if (period === 5 * periodsPerYear) {
      balanceYear5 = Math.round(balance);
    }

    // Yearly tracking for charts
    if (period % periodsPerYear === 0 || balance <= 0.01) {
      const year = Math.ceil(period / periodsPerYear);
      balanceAtYears.push({
        year,
        balance: Math.round(balance),
        cumulativeInterest: Math.round(totalInterest)
      });
    }
  }

  const totalYears = period / periodsPerYear;
  const fullYears = Math.floor(totalYears);
  const remainingMonths = Math.round((totalYears - fullYears) * 12);

  return {
    scheduleType,
    paymentPerPeriod: pmt,
    periodsPerYear,
    annualTotalPayment: pmt * periodsPerYear + annualLumpSum,
    totalInterestPaid: Math.round(totalInterest),
    totalYearsToPayoff: parseFloat(totalYears.toFixed(2)),
    payoffDisplay: `${fullYears} yrs ${remainingMonths} mos`,
    balanceYear5: balanceYear5 || Math.round(balance),
    balanceAtYears
  };
}

export function calcAcceleratedBiweeklyMortgage(inputs) {
  const {
    mortgagePrincipal = 550000,
    annualInterestRate = 0.0489, // 4.89% standard 5-yr fixed
    amortizationYears = 25,
    annualPrepaymentLumpSum = 0
  } = inputs;

  if (mortgagePrincipal <= 0 || isNaN(mortgagePrincipal)) throw new RangeError('Principal must be positive');
  if (annualInterestRate <= 0 || isNaN(annualInterestRate)) throw new RangeError('Rate must be positive');

  // Base Canadian Monthly Payment
  const baseMonthlyPmt = calcCanadianMonthlyPayment(mortgagePrincipal, annualInterestRate, amortizationYears);

  // Run the 3 core schedules + 1 lump sum schedule
  const monthlySched = simulateAmortizationSchedule(mortgagePrincipal, annualInterestRate, 'monthly', baseMonthlyPmt, 0);
  const regBiweeklySched = simulateAmortizationSchedule(mortgagePrincipal, annualInterestRate, 'regular_biweekly', baseMonthlyPmt, 0);
  const accBiweeklySched = simulateAmortizationSchedule(mortgagePrincipal, annualInterestRate, 'accelerated_biweekly', baseMonthlyPmt, 0);
  const accPlusLumpSched = simulateAmortizationSchedule(mortgagePrincipal, annualInterestRate, 'accelerated_biweekly', baseMonthlyPmt, annualPrepaymentLumpSum);

  // Savings Calculations
  const interestSavedAccelerated = monthlySched.totalInterestPaid - accBiweeklySched.totalInterestPaid;
  const timeSavedYearsAccelerated = monthlySched.totalYearsToPayoff - accBiweeklySched.totalYearsToPayoff;
  const regBiweeklyInterestDiff = monthlySched.totalInterestPaid - regBiweeklySched.totalInterestPaid;

  return {
    mortgagePrincipal,
    annualInterestRatePct: (annualInterestRate * 100).toFixed(2),
    amortizationYears,
    baseMonthlyPayment: Math.round(baseMonthlyPmt),
    monthly: monthlySched,
    regularBiweekly: regBiweeklySched,
    acceleratedBiweekly: accBiweeklySched,
    acceleratedPlusLump: accPlusLumpSched,
    savings: {
      interestSavedAccelerated: Math.round(interestSavedAccelerated),
      timeSavedYears: parseFloat(timeSavedYearsAccelerated.toFixed(1)),
      regVsAccBiweeklyGap: Math.round(regBiweeklySched.totalInterestPaid - accBiweeklySched.totalInterestPaid),
      year5BalanceDifference: Math.round(monthlySched.balanceYear5 - accBiweeklySched.balanceYear5)
    }
  };
}
