export function calcAnnualSolarProduction(systemKw, annualKwhPerKw = 1450, degradationRate = 0.005, year = 1) {
  if (systemKw <= 0 || isNaN(systemKw)) return 0;
  const baseYear1Kwh = systemKw * annualKwhPerKw;
  return baseYear1Kwh * Math.pow(1 - degradationRate, year - 1);
}

export function calcSolarCashVsLease(inputs) {
  const {
    systemSizeKw = 8.5,
    grossSystemCost = 27500, // $3.24/W
    utilityRateKwh = 0.22,
    utilityInflationRate = 0.04,
    solarProductionKwhPerKw = 1450,
    solarDegradationRate = 0.005,
    leaseYear1MonthlyPmt = 115,
    leaseEscalatorRate = 0.019, // 1.9% annual escalator
    loanInterestRate = 0.075,
    loanTermYears = 20,
    loanDealerFeePct = 0.15,
    tpoYear5BuyoutFmv = 10500
  } = inputs;

  if (systemSizeKw <= 0 || isNaN(systemSizeKw)) throw new RangeError('System size must be positive');
  if (grossSystemCost <= 0 || isNaN(grossSystemCost)) throw new RangeError('System cost must be positive');
  if (utilityRateKwh <= 0 || isNaN(utilityRateKwh)) throw new RangeError('Utility rate must be positive');

  // Statutory 2026 tax credit reality:
  // Section 25D residential credit is 0% (repealed after 2025)
  const sec25dCreditAmount = 0;
  const netCashCost = grossSystemCost - sec25dCreditAmount;

  // Commercial Section 48E credit available to third-party owned (TPO) lease/PPA: 30%
  const sec48eCommercialCreditValue = grossSystemCost * 0.30;

  // 20-Year Loan Calculation
  const totalLoanPrincipal = grossSystemCost * (1 + loanDealerFeePct);
  const loanMonths = loanTermYears * 12;
  const rm = loanInterestRate / 12;
  const loanMonthlyPmt = rm > 0
    ? totalLoanPrincipal * (rm * Math.pow(1 + rm, loanMonths)) / (Math.pow(1 + rm, loanMonths) - 1)
    : totalLoanPrincipal / loanMonths;

  // 25-Year Cumulative Simulation
  let cumulativeUtilityCostWithoutSolar = 0;
  let cumulativeCashSavings = 0;
  let cumulativeLoanSavings = 0;
  let cumulativeLeaseSavings = 0;
  let cumulativePrepaidBuyoutSavings = 0;

  let breakEvenCashYear = null;
  let breakEvenLoanYear = null;
  let breakEvenLeaseYear = null;

  const annualSchedule = [];

  let currentUtilityRate = utilityRateKwh;
  let currentLeaseMonthly = leaseYear1MonthlyPmt;

  for (let yr = 1; yr <= 25; yr++) {
    const yrSolarKwh = calcAnnualSolarProduction(systemSizeKw, solarProductionKwhPerKw, solarDegradationRate, yr);
    const yrAvoidedUtilityCost = yrSolarKwh * currentUtilityRate;
    cumulativeUtilityCostWithoutSolar += yrAvoidedUtilityCost;

    // Strategy A: Cash
    const yrCashOutflow = (yr === 1) ? netCashCost : 0;
    const yrCashNet = yrAvoidedUtilityCost - yrCashOutflow;
    cumulativeCashSavings += yrCashNet;
    if (breakEvenCashYear === null && cumulativeCashSavings >= 0) {
      breakEvenCashYear = yr;
    }

    // Strategy B: Loan
    const yrLoanOutflow = (yr <= loanTermYears) ? (loanMonthlyPmt * 12) : 0;
    const yrLoanNet = yrAvoidedUtilityCost - yrLoanOutflow;
    cumulativeLoanSavings += yrLoanNet;
    if (breakEvenLoanYear === null && cumulativeLoanSavings >= 0) {
      breakEvenLoanYear = yr;
    }

    // Strategy C: TPO Lease / PPA
    const yrLeaseOutflow = currentLeaseMonthly * 12;
    const yrLeaseNet = yrAvoidedUtilityCost - yrLeaseOutflow;
    cumulativeLeaseSavings += yrLeaseNet;
    if (breakEvenLeaseYear === null && cumulativeLeaseSavings >= 0) {
      breakEvenLeaseYear = yr;
    }

    // Strategy D: TPO Lease with Year 5 Buyout
    const yrBuyoutOutflow = (yr === 5) ? tpoYear5BuyoutFmv : (yr < 5 ? yrLeaseOutflow : 0);
    const yrBuyoutNet = yrAvoidedUtilityCost - yrBuyoutOutflow;
    cumulativePrepaidBuyoutSavings += yrBuyoutNet;

    annualSchedule.push({
      year: yr,
      solarKwh: yrSolarKwh,
      utilityRate: currentUtilityRate,
      avoidedUtilityCost: yrAvoidedUtilityCost,
      cashCumulativeSavings: cumulativeCashSavings,
      loanCumulativeSavings: cumulativeLoanSavings,
      leaseCumulativeSavings: cumulativeLeaseSavings,
      buyoutCumulativeSavings: cumulativePrepaidBuyoutSavings
    });

    currentUtilityRate *= (1 + utilityInflationRate);
    currentLeaseMonthly *= (1 + leaseEscalatorRate);
  }

  return {
    systemSizeKw,
    grossSystemCost,
    sec25dCreditAmount,
    sec48eCommercialCreditValue,
    netCashCost,
    loan: {
      totalPrincipal: totalLoanPrincipal,
      monthlyPayment: loanMonthlyPmt,
      termYears: loanTermYears,
      totalInterest: (loanMonthlyPmt * loanMonths) - totalLoanPrincipal
    },
    lease: {
      year1MonthlyPmt: leaseYear1MonthlyPmt,
      escalatorRate: leaseEscalatorRate,
      year25MonthlyPmt: leaseYear1MonthlyPmt * Math.pow(1 + leaseEscalatorRate, 24)
    },
    twentyFiveYearTotals: {
      utilityWithoutSolar: cumulativeUtilityCostWithoutSolar,
      cashNetSavings: cumulativeCashSavings,
      loanNetSavings: cumulativeLoanSavings,
      leaseNetSavings: cumulativeLeaseSavings,
      buyoutNetSavings: cumulativePrepaidBuyoutSavings
    },
    breakEven: {
      cashYear: breakEvenCashYear,
      loanYear: breakEvenLoanYear,
      leaseYear: breakEvenLeaseYear
    },
    annualSchedule
  };
}
