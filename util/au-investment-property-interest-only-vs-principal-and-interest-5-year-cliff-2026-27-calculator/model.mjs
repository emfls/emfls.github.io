// Australian Investment Property Financing & Repayment Cliff Mechanics
// - Strategy A: 5-Year Interest-Only (IO) followed by 25-Year P&I Amortization
// - Strategy B: 30-Year Principal & Interest (P&I) Amortization from Day 1
//
// FY 2026–27 Tax Brackets (including 2% Medicare Levy):
// - 32% Marginal Rate ($45,001 - $135,000)
// - 39% Marginal Rate ($135,001 - $190,000)
// - 47% Marginal Rate ($190,001+)

export const ATO_MARGINAL_TAX_RATES = {
  tier1: { label: '32% (Inc. 2% Medicare)', rate: 0.32 },
  tier2: { label: '39% (Inc. 2% Medicare)', rate: 0.39 },
  tier3: { label: '47% (Top Rate + 2% Medicare)', rate: 0.47 }
};

export function calcMonthlyAmortization(principal, annualRate, termMonths) {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRate <= 0) return principal / termMonths;
  const r = annualRate / 12;
  return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

export function calcInterestOnlyVsPandI(inputs) {
  const {
    loanAmount = 750000,
    loanTermYears = 30,
    ioPeriodYears = 5,
    pAndIInterestRate = 0.0605, // 6.05% standard investment P&I rate
    ioInterestRate = 0.0635,    // 6.35% (typical +0.30% premium on IO)
    marginalTaxRate = 0.39,     // 39% ATO marginal rate
    redirectSurplusToPporOffset = true,
    pporMortgageRate = 0.0595   // 5.95% non-deductible home loan rate
  } = inputs;

  if (loanAmount <= 0 || isNaN(loanAmount)) throw new RangeError('Loan amount must be positive');
  if (ioPeriodYears < 1 || ioPeriodYears > 10) throw new RangeError('IO period must be between 1 and 10 years');

  // Strategy A: 5-Year Interest-Only
  const monthlyIoPmt = (loanAmount * ioInterestRate) / 12;
  const remainingTermMonths = (loanTermYears - ioPeriodYears) * 12; // 25 years = 300 months
  // Year 6 Cliff Payment: Remaining balance amortized over remaining 25 years
  const year6PostIoPmt = calcMonthlyAmortization(loanAmount, pAndIInterestRate, remainingTermMonths);
  const cliffDollarIncrease = year6PostIoPmt - monthlyIoPmt;
  const cliffPctIncrease = (cliffDollarIncrease / monthlyIoPmt) * 100;

  // Strategy B: 30-Year P&I from Day 1
  const standardPAndIPmt = calcMonthlyAmortization(loanAmount, pAndIInterestRate, loanTermYears * 12);

  // Initial 5-Year Monthly Cash Flow Comparison
  const monthlyPreTaxCashFlowGap = standardPAndIPmt - monthlyIoPmt; // positive means IO has lower monthly payment

  // 10-Year Trajectory Simulation
  let balIo = loanAmount;
  let balPi = loanAmount;
  let cumTaxDeductionsIo = 0;
  let cumTaxDeductionsPi = 0;
  let pporOffsetBalance = 0;
  let pporInterestSaved = 0;

  const yearlyBreakdown = [];

  for (let y = 1; y <= 10; y++) {
    const isIoYear = y <= ioPeriodYears;
    let yrInterestIo = 0;
    let yrInterestPi = 0;
    let yrPaymentsIo = 0;
    let yrPaymentsPi = standardPAndIPmt * 12;

    for (let m = 1; m <= 12; m++) {
      // IO loan
      if (isIoYear) {
        const int = (balIo * ioInterestRate) / 12;
        yrInterestIo += int;
        yrPaymentsIo += monthlyIoPmt;
        // Surplus cash flow to PPOR offset
        if (redirectSurplusToPporOffset) {
          const surplus = monthlyPreTaxCashFlowGap;
          pporOffsetBalance += surplus;
          pporInterestSaved += (pporOffsetBalance * (pporMortgageRate / 12));
        }
      } else {
        const int = (balIo * pAndIInterestRate) / 12;
        const pmt = year6PostIoPmt;
        const princ = pmt - int;
        balIo -= princ;
        yrInterestIo += int;
        yrPaymentsIo += pmt;
      }

      // P&I loan
      const intPi = (balPi * pAndIInterestRate) / 12;
      const princPi = standardPAndIPmt - intPi;
      balPi -= princPi;
      yrInterestPi += intPi;
    }

    const taxShieldIo = yrInterestIo * marginalTaxRate;
    const taxShieldPi = yrInterestPi * marginalTaxRate;
    cumTaxDeductionsIo += taxShieldIo;
    cumTaxDeductionsPi += taxShieldPi;

    yearlyBreakdown.push({
      year: y,
      isIo: isIoYear,
      monthlyPmtIo: Math.round(isIoYear ? monthlyIoPmt : year6PostIoPmt),
      monthlyPmtPi: Math.round(standardPAndIPmt),
      loanBalIo: Math.round(balIo),
      loanBalPi: Math.round(balPi)
    });
  }

  // Net 10-Year Position
  const principalPaidPi10Yr = loanAmount - balPi;
  const principalPaidIo10Yr = loanAmount - balIo;
  const taxSavingsDifference10Yr = cumTaxDeductionsIo - cumTaxDeductionsPi;

  return {
    loanAmount,
    monthlyIoPmt: Math.round(monthlyIoPmt),
    year6PostIoPmt: Math.round(year6PostIoPmt),
    cliffDollarIncrease: Math.round(cliffDollarIncrease),
    cliffPctIncrease: parseFloat(cliffPctIncrease.toFixed(1)),
    standardPAndIPmt: Math.round(standardPAndIPmt),
    initialMonthlyCashFlowAdvantage: Math.round(monthlyPreTaxCashFlowGap),
    tenYearSummary: {
      principalPaidPi: Math.round(principalPaidPi10Yr),
      principalPaidIo: Math.round(principalPaidIo10Yr),
      taxShieldAdvantageIo: Math.round(taxSavingsDifference10Yr),
      pporInterestSaved: Math.round(pporInterestSaved),
      netOffsetFundAccumulated: Math.round(pporOffsetBalance)
    },
    yearlyBreakdown
  };
}
