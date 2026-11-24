// 2026 HUD FHA Mortgagee Letter & Conventional Fannie/Freddie Statutory Parameters
export const FHA_CONSTANTS_2026 = {
  loanLimitFloor: 541287,
  loanLimitCeiling: 1249125,
  loanLimitSpecial: 1873625,
  ufmipRate: 0.0175, // 1.75% Upfront MIP
  annualMipTier1: 0.0055, // 0.55% for <= $726,200 and LTV > 95%
  annualMipTier2: 0.0050, // 0.50% for <= $726,200 and LTV <= 95%
  annualMipHighBalanceTier1: 0.0075, // 0.75% for > $726,200 and LTV > 95%
  annualMipHighBalanceTier2: 0.0070, // 0.70% for > $726,200 and LTV <= 95%
  highBalanceThreshold: 726200
};

export function calcMonthlyAmortization(principal, annualRate, termYears = 30) {
  if (principal <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;
  if (monthlyRate === 0) return principal / numPayments;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
}

export function calcFhaVsConventional(inputs) {
  const {
    homePrice = 450000,
    fhaDownPercent = 3.5, // %
    convDownPercent = 5.0, // %
    fhaInterestRate = 6.25, // %
    convInterestRate = 6.75, // %
    convPmiAnnualRate = 0.65, // % (typical for 700-720 FICO at 95% LTV)
    appreciationRate = 3.5, // % annual home price appreciation
    termYears = 30,
    financeUfmip = true,
    refinanceCostPercent = 2.5 // % closing cost to refinance into Conventional at 80% LTV
  } = inputs;

  const fhaDownPayment = homePrice * (fhaDownPercent / 100);
  const fhaBaseLoan = homePrice - fhaDownPayment;
  const ufmipAmount = fhaBaseLoan * FHA_CONSTANTS_2026.ufmipRate;
  const fhaTotalLoan = financeUfmip ? (fhaBaseLoan + ufmipAmount) : fhaBaseLoan;
  const fhaLtv = (fhaBaseLoan / homePrice) * 100;

  // Annual MIP rate determination
  let fhaAnnualMipRate = FHA_CONSTANTS_2026.annualMipTier1;
  if (fhaBaseLoan > FHA_CONSTANTS_2026.highBalanceThreshold) {
    fhaAnnualMipRate = (fhaLtv > 95) ? FHA_CONSTANTS_2026.annualMipHighBalanceTier1 : FHA_CONSTANTS_2026.annualMipHighBalanceTier2;
  } else {
    fhaAnnualMipRate = (fhaLtv > 95) ? FHA_CONSTANTS_2026.annualMipTier1 : FHA_CONSTANTS_2026.annualMipTier2;
  }

  // FHA MIP duration rule: if down payment < 10%, lifetime (360 months). If >= 10%, 11 years (132 months).
  const fhaMipMonths = (fhaDownPercent >= 10.0) ? 132 : (termYears * 12);

  // Conventional Loan
  const convDownPayment = homePrice * (convDownPercent / 100);
  const convLoan = homePrice - convDownPayment;

  // Monthly P&I payments
  const fhaMonthlyPI = calcMonthlyAmortization(fhaTotalLoan, fhaInterestRate, termYears);
  const convMonthlyPI = calcMonthlyAmortization(convLoan, convInterestRate, termYears);

  // Monthly amort schedules & MI calculations
  const totalMonths = termYears * 12;
  let fhaBalance = fhaTotalLoan;
  let convBalance = convLoan;
  const fhaMonthlyRate = fhaInterestRate / 100 / 12;
  const convMonthlyRate = convInterestRate / 100 / 12;

  let fhaTotalMipPaid = 0;
  let convTotalPmiPaid = 0;
  let fhaTotalPaid5Yr = 0;
  let convTotalPaid5Yr = 0;
  let fhaTotalPaid10Yr = 0;
  let convTotalPaid10Yr = 0;
  let fhaTotalPaid30Yr = 0;
  let convTotalPaid30Yr = 0;

  let convPmiDropMonth = null;
  let natural80LtvMonth = null;

  // Initial monthly payments
  const fhaInitialMonthlyMip = (fhaTotalLoan * fhaAnnualMipRate) / 12;
  const convInitialMonthlyPmi = (convLoan * (convPmiAnnualRate / 100)) / 12;
  const fhaInitialTotalMonthly = fhaMonthlyPI + fhaInitialMonthlyMip;
  const convInitialTotalMonthly = convMonthlyPI + convInitialMonthlyPmi;

  for (let m = 1; m <= totalMonths; m++) {
    // Current home value with appreciation
    const currentHomeVal = homePrice * Math.pow(1 + (appreciationRate / 100 / 12), m);

    // FHA monthly tracking
    let fhaMipThisMonth = 0;
    if (m <= fhaMipMonths && fhaBalance > 0) {
      // Annual MIP is calculated on remaining balance
      fhaMipThisMonth = (fhaBalance * fhaAnnualMipRate) / 12;
    }
    fhaTotalMipPaid += fhaMipThisMonth;

    const fhaInterest = fhaBalance * fhaMonthlyRate;
    const fhaPrincipal = Math.min(fhaBalance, fhaMonthlyPI - fhaInterest);
    fhaBalance = Math.max(0, fhaBalance - fhaPrincipal);
    const fhaPaymentThisMonth = fhaPrincipal + fhaInterest + fhaMipThisMonth;

    // Conventional monthly tracking
    // PMI automatically drops at 78% LTV of ORIGINAL value, or borrower cancels at 80% LTV of ORIGINAL value
    const convLtvOriginal = (convBalance / homePrice) * 100;
    let convPmiThisMonth = 0;
    if (convLtvOriginal > 78.0 && convBalance > 0) {
      convPmiThisMonth = (convBalance * (convPmiAnnualRate / 100)) / 12;
    } else if (convPmiDropMonth === null) {
      convPmiDropMonth = m;
    }
    convTotalPmiPaid += convPmiThisMonth;

    const convInterest = convBalance * convMonthlyRate;
    const convPrincipal = Math.min(convBalance, convMonthlyPI - convInterest);
    convBalance = Math.max(0, convBalance - convPrincipal);
    const convPaymentThisMonth = convPrincipal + convInterest + convPmiThisMonth;

    // Check when FHA loan reaches 80% LTV based on appreciated value (refinance opportunity)
    if (natural80LtvMonth === null && (fhaBalance / currentHomeVal) <= 0.80) {
      natural80LtvMonth = m;
    }

    // Cumulative tallies
    if (m <= 60) {
      fhaTotalPaid5Yr += fhaPaymentThisMonth;
      convTotalPaid5Yr += convPaymentThisMonth;
    }
    if (m <= 120) {
      fhaTotalPaid10Yr += fhaPaymentThisMonth;
      convTotalPaid10Yr += convPaymentThisMonth;
    }
    fhaTotalPaid30Yr += fhaPaymentThisMonth;
    convTotalPaid30Yr += convPaymentThisMonth;
  }

  if (convPmiDropMonth === null) convPmiDropMonth = totalMonths;
  if (natural80LtvMonth === null) natural80LtvMonth = totalMonths;

  // Add upfront costs
  const fhaUpfrontPaid = financeUfmip ? fhaDownPayment : (fhaDownPayment + ufmipAmount);
  const convUpfrontPaid = convDownPayment;

  // Refinance Breakeven Month calculation
  // Refinance cost = 2.5% of remaining FHA balance at 80% LTV
  const refiBalance = fhaTotalLoan * 0.85; // approx
  const estimatedRefiCost = refiBalance * (refinanceCostPercent / 100);
  const monthlySavingsAfterRefi = fhaInitialMonthlyMip; // eliminating MIP
  const refiBreakevenMonths = monthlySavingsAfterRefi > 0 ? Math.ceil(estimatedRefiCost / monthlySavingsAfterRefi) : 0;
  const totalMonthsToRefiBreakeven = (natural80LtvMonth || 36) + refiBreakevenMonths;

  return {
    homePrice,
    fhaBaseLoan: Math.round(fhaBaseLoan),
    ufmipAmount: Math.round(ufmipAmount),
    fhaTotalLoan: Math.round(fhaTotalLoan),
    fhaDownPayment: Math.round(fhaDownPayment),
    fhaMonthlyPI: Math.round(fhaMonthlyPI * 100) / 100,
    fhaInitialMonthlyMip: Math.round(fhaInitialMonthlyMip * 100) / 100,
    fhaInitialTotalMonthly: Math.round(fhaInitialTotalMonthly * 100) / 100,
    fhaAnnualMipRate: Math.round(fhaAnnualMipRate * 10000) / 100, // as %
    fhaMipMonths,
    fhaTotalMipPaid: Math.round(fhaTotalMipPaid),

    convLoan: Math.round(convLoan),
    convDownPayment: Math.round(convDownPayment),
    convMonthlyPI: Math.round(convMonthlyPI * 100) / 100,
    convInitialMonthlyPmi: Math.round(convInitialMonthlyPmi * 100) / 100,
    convInitialTotalMonthly: Math.round(convInitialTotalMonthly * 100) / 100,
    convPmiDropMonth,
    convTotalPmiPaid: Math.round(convTotalPmiPaid),

    // Comparisons
    initialMonthlyDiff: Math.round((fhaInitialTotalMonthly - convInitialTotalMonthly) * 100) / 100,
    totalMiDifference: Math.round(fhaTotalMipPaid - convTotalPmiPaid),
    fhaTotalPaid5Yr: Math.round(fhaTotalPaid5Yr + fhaUpfrontPaid),
    convTotalPaid5Yr: Math.round(convTotalPaid5Yr + convUpfrontPaid),
    fhaTotalPaid10Yr: Math.round(fhaTotalPaid10Yr + fhaUpfrontPaid),
    convTotalPaid10Yr: Math.round(convTotalPaid10Yr + convUpfrontPaid),
    fhaTotalPaid30Yr: Math.round(fhaTotalPaid30Yr + fhaUpfrontPaid),
    convTotalPaid30Yr: Math.round(convTotalPaid30Yr + convUpfrontPaid),

    natural80LtvMonth,
    estimatedRefiCost: Math.round(estimatedRefiCost),
    refiBreakevenMonths,
    totalMonthsToRefiBreakeven
  };
}
