// 2026 Department of Veterans Affairs (VA) Funding Fee Schedule (Purchase Loans)
// - Less than 5% down: First Use = 2.15%, Subsequent Use = 3.30%
// - 5% to <10% down: 1.50% (First & Subsequent)
// - 10% or more down: 1.25% (First & Subsequent)
// - 100% EXEMPT (0.00%): Veterans receiving VA disability compensation (>=10% rating),
//   Purple Heart recipients serving on active duty, and eligible surviving spouses!

export const VA_FUNDING_FEE_RATES_2026 = {
  tier1: { maxDownPct: 0.05, firstUse: 0.0215, subsequentUse: 0.0330 },
  tier2: { maxDownPct: 0.10, firstUse: 0.0150, subsequentUse: 0.0150 },
  tier3: { minDownPct: 0.10, firstUse: 0.0125, subsequentUse: 0.0125 }
};

export function getVaFundingFeePct(downPaymentPct, isSubsequentUse = false, isDisabledExempt = false) {
  if (isDisabledExempt) return 0.0;
  if (downPaymentPct < 0.05) {
    return isSubsequentUse ? VA_FUNDING_FEE_RATES_2026.tier1.subsequentUse : VA_FUNDING_FEE_RATES_2026.tier1.firstUse;
  } else if (downPaymentPct < 0.10) {
    return VA_FUNDING_FEE_RATES_2026.tier2.firstUse;
  } else {
    return VA_FUNDING_FEE_RATES_2026.tier3.firstUse;
  }
}

export function calcMonthlyPmt(principal, annualRate, termYears = 30) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / (termYears * 12);
  const r = annualRate / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calcVaVsConventional(inputs) {
  const {
    homePrice = 450000,
    downPaymentPct = 0.0, // 0% to 20%
    isSubsequentUse = false,
    isDisabledExempt = false,
    vaInterestRate = 0.0625, // VA loans typically 0.35% - 0.50% lower than conventional
    conventionalInterestRate = 0.0675,
    financeVaFundingFee = true,
    conventionalPmiAnnualRate = 0.0068, // 0.68% typical annual PMI
    homeAppreciationRate = 0.035,
    termYears = 30
  } = inputs;

  if (homePrice <= 0 || isNaN(homePrice)) throw new RangeError('Home price must be positive');
  if (downPaymentPct < 0 || downPaymentPct > 0.50) throw new RangeError('Down payment must be between 0% and 50%');

  const downPaymentDollar = homePrice * downPaymentPct;
  const baseLoanAmount = homePrice - downPaymentDollar;

  // VA Loan calculations
  const vaFeeRate = getVaFundingFeePct(downPaymentPct, isSubsequentUse, isDisabledExempt);
  const vaFundingFeeDollar = baseLoanAmount * vaFeeRate;
  const vaTotalLoan = financeVaFundingFee ? (baseLoanAmount + vaFundingFeeDollar) : baseLoanAmount;
  const vaUpfrontCash = downPaymentDollar + (financeVaFundingFee ? 0 : vaFundingFeeDollar);
  const vaMonthlyPmt = calcMonthlyPmt(vaTotalLoan, vaInterestRate, termYears);
  const vaMonthlyPmi = 0; // VA loans have ZERO monthly mortgage insurance!

  // Conventional Loan calculations
  // Conventional min down payment is typically 3% if less than 5%
  const convDownPct = Math.max(0.03, downPaymentPct);
  const convDownDollar = homePrice * convDownPct;
  const convBaseLoan = homePrice - convDownDollar;
  const convMonthlyPI = calcMonthlyPmt(convBaseLoan, conventionalInterestRate, termYears);
  
  // PMI applies if down payment < 20%
  const initialLtv = convBaseLoan / homePrice;
  let convMonthlyPmi = 0;
  let pmiDropoffMonth = 0;

  if (initialLtv > 0.80) {
    convMonthlyPmi = (convBaseLoan * conventionalPmiAnnualRate) / 12;
    // Estimate months until 80% LTV through principal paydown & appreciation
    let curBal = convBaseLoan;
    let curVal = homePrice;
    const rConv = conventionalInterestRate / 12;
    const mApprec = Math.pow(1 + homeAppreciationRate, 1 / 12) - 1;

    for (let m = 1; m <= termYears * 12; m++) {
      const interest = curBal * rConv;
      const principal = convMonthlyPI - interest;
      curBal -= principal;
      curVal *= (1 + mApprec);
      if (curBal / curVal <= 0.80 && pmiDropoffMonth === 0) {
        pmiDropoffMonth = m;
        break;
      }
    }
  }

  const convInitialMonthly = convMonthlyPI + convMonthlyPmi;

  // 5-Year and 30-Year comparisons
  let va5YrPayments = 0;
  let conv5YrPayments = 0;
  let totalPmiPaid = 0;

  for (let m = 1; m <= 60; m++) {
    va5YrPayments += vaMonthlyPmt;
    const pmiThisMonth = (pmiDropoffMonth === 0 || m <= pmiDropoffMonth) ? convMonthlyPmi : 0;
    totalPmiPaid += pmiThisMonth;
    conv5YrPayments += (convMonthlyPI + pmiThisMonth);
  }

  const va5YrTotalCost = vaUpfrontCash + va5YrPayments;
  const conv5YrTotalCost = convDownDollar + conv5YrPayments;
  const fiveYearSavingsVa = conv5YrTotalCost - va5YrTotalCost;

  // 30-Year Total Lifetime Cost
  const va30YrPayments = vaMonthlyPmt * termYears * 12;
  const totalLifetimePmi = convMonthlyPmi * (pmiDropoffMonth > 0 ? pmiDropoffMonth : (initialLtv > 0.80 ? 84 : 0));
  const conv30YrPayments = (convMonthlyPI * termYears * 12) + totalLifetimePmi;
  const vaLifetimeTotalCost = vaUpfrontCash + va30YrPayments;
  const convLifetimeTotalCost = convDownDollar + conv30YrPayments;
  const lifetimeSavingsVa = convLifetimeTotalCost - vaLifetimeTotalCost;

  // Disabled Exemption Dollar Value (if exempt, what would fee have been)
  const feeIfNonExempt = baseLoanAmount * getVaFundingFeePct(downPaymentPct, isSubsequentUse, false);
  const exemptionDollarSavings = isDisabledExempt ? feeIfNonExempt : 0;

  return {
    homePrice,
    downPaymentDollar,
    va: {
      fundingFeePct: vaFeeRate * 100,
      fundingFeeDollar: Math.round(vaFundingFeeDollar),
      totalLoan: Math.round(vaTotalLoan),
      monthlyPmt: Math.round(vaMonthlyPmt),
      upfrontCash: Math.round(vaUpfrontCash),
      fiveYearTotalCost: Math.round(va5YrTotalCost),
      lifetimeTotalCost: Math.round(vaLifetimeTotalCost)
    },
    conventional: {
      downPaymentDollar: Math.round(convDownDollar),
      monthlyPI: Math.round(convMonthlyPI),
      monthlyPmi: Math.round(convMonthlyPmi),
      initialMonthlyTotal: Math.round(convInitialMonthly),
      pmiDropoffYears: pmiDropoffMonth > 0 ? parseFloat((pmiDropoffMonth / 12).toFixed(1)) : 0,
      totalPmiPaid5Yr: Math.round(totalPmiPaid),
      fiveYearTotalCost: Math.round(conv5YrTotalCost),
      lifetimeTotalCost: Math.round(convLifetimeTotalCost)
    },
    comparison: {
      monthlyDifference: Math.round(convInitialMonthly - vaMonthlyPmt),
      fiveYearSavingsVa: Math.round(fiveYearSavingsVa),
      lifetimeSavingsVa: Math.round(lifetimeSavingsVa),
      exemptionDollarSavings: Math.round(exemptionDollarSavings)
    }
  };
}
