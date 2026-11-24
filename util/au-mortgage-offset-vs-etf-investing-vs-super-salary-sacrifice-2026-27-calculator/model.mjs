// FY 2026–27 Australian Taxation Office (ATO) Statutory Parameters & Stage 3 Rates
export const ATO_CONSTANTS_2026 = {
  concessionalCap: 32500, // FY26/27 Concessional Cap
  superContributionsTaxRate: 0.15, // 15% standard
  div293Threshold: 250000, // $250,000 threshold
  div293AdditionalTax: 0.15, // Extra 15%
  medicareLevyRate: 0.02, // 2%
  superEarningsTaxRate: 0.15, // 15% inside super accumulation
  cgtDiscountIndividual: 0.50, // 50% CGT discount outside super
  cgtDiscountSuper: 0.3333, // 33.33% CGT discount inside super
  taxBrackets: [
    { max: 18200, baseRate: 0.00 },
    { max: 45000, baseRate: 0.16 },
    { max: 135000, baseRate: 0.30 },
    { max: 190000, baseRate: 0.37 },
    { max: Infinity, baseRate: 0.45 }
  ]
};

export function getMarginalTaxRate(taxableIncome, includeMedicare = true) {
  let base = 0.30;
  for (const b of ATO_CONSTANTS_2026.taxBrackets) {
    if (taxableIncome <= b.max) {
      base = b.baseRate;
      break;
    }
  }
  const total = base + (includeMedicare ? ATO_CONSTANTS_2026.medicareLevyRate : 0);
  return Math.round(total * 100) / 100;
}

export function calcEquivalentGrossReturn(offsetRatePercent, marginalTaxRate) {
  if (marginalTaxRate >= 1) return offsetRatePercent;
  return offsetRatePercent / (1 - marginalTaxRate);
}

export function calcOffsetVsEtfVsSuper(inputs) {
  const {
    taxableIncome = 150000,
    lumpSum = 20000, // Extra initial cash ($)
    monthlyContribution = 500, // Extra monthly cash from paycheck ($)
    mortgageRate = 6.20, // %
    etfTotalReturn = 8.50, // % (e.g. 3.5% yield + 5.0% growth)
    etfYieldRatio = 0.40, // 40% of return is annual distribution, 60% growth
    years = 15,
    div293Applies = false
  } = inputs;

  const marginalRate = getMarginalTaxRate(taxableIncome);
  const superTaxRate = div293Applies ? 0.30 : ATO_CONSTANTS_2026.superContributionsTaxRate;

  // 1. Equivalent Gross Pre-Tax Return to beat Offset
  const equivalentGrossReturn = calcEquivalentGrossReturn(mortgageRate, marginalRate);

  // 2. Compounding simulation month by month
  const totalMonths = years * 12;

  // Option 1: PPOR Mortgage Offset
  // All cash deposited directly reduces mortgage balance.
  // Growth is guaranteed tax-free savings at mortgageRate
  const offsetMonthlyRate = mortgageRate / 100 / 12;
  let offsetBalance = lumpSum;
  for (let m = 1; m <= totalMonths; m++) {
    offsetBalance = offsetBalance * (1 + offsetMonthlyRate) + monthlyContribution;
  }

  // Option 2: ETF Portfolio (Outside Super)
  // Lump sum and monthly contributions are post-tax cash.
  // Annual dividend yield is taxed at marginalRate.
  // Capital growth compounds untaxed until end, then taxed with 50% CGT discount.
  const annualYield = (etfTotalReturn / 100) * etfYieldRatio;
  const annualGrowth = (etfTotalReturn / 100) * (1 - etfYieldRatio);
  const netAnnualYield = annualYield * (1 - marginalRate); // tax paid annually on distributions
  const effectiveMonthlyEtfRate = (netAnnualYield + annualGrowth) / 12;

  let etfTotalContributed = lumpSum;
  let etfBalance = lumpSum;
  for (let m = 1; m <= totalMonths; m++) {
    etfBalance = etfBalance * (1 + effectiveMonthlyEtfRate) + monthlyContribution;
    etfTotalContributed += monthlyContribution;
  }
  // At end of period, deduct CGT on accumulated capital gain
  const totalEtfGain = Math.max(0, etfBalance - etfTotalContributed);
  const taxableEtfGain = totalEtfGain * (1 - ATO_CONSTANTS_2026.cgtDiscountIndividual);
  const cgtPaidOnExit = taxableEtfGain * marginalRate;
  const etfNetWealth = etfBalance - cgtPaidOnExit;

  // Option 3: Concessional Super Salary Sacrifice
  // To make a fair comparison:
  // monthlyContribution is POST-TAX cash.
  // In salary sacrifice, that pre-tax gross paycheck amount is: monthlyContribution / (1 - marginalRate).
  // Inside super, it incurs superTaxRate (15% or 30%).
  // Net cash entering super each month: [monthlyContribution / (1 - marginalRate)] * (1 - superTaxRate).
  const preTaxSalaryEquivalent = monthlyContribution / (1 - marginalRate);
  const monthlySuperDeposit = preTaxSalaryEquivalent * (1 - superTaxRate);

  // For the lump sum: personal deductible contribution (claimed on tax return):
  // You deposit lumpSum post-tax, but claim tax deduction getting back lumpSum * marginalRate!
  // To keep apples-to-apples initial net cash equal, grossed-up lump sum deposited = lumpSum / (1 - marginalRate).
  const grossLumpSumEquivalent = lumpSum / (1 - marginalRate);
  let superBalance = grossLumpSumEquivalent * (1 - superTaxRate);

  // Inside super, earnings tax is max 15% (reduced by 1/3 CGT discount to ~10%)
  const superNetReturn = (etfTotalReturn / 100) * (1 - 0.12); // ~12% effective tax inside super
  const superMonthlyRate = superNetReturn / 12;

  for (let m = 1; m <= totalMonths; m++) {
    superBalance = superBalance * (1 + superMonthlyRate) + monthlySuperDeposit;
  }
  const superNetWealth = superBalance; // Tax-free upon retirement post age 60!

  // Immediate Upfront Tax Arbitrage for Super (e.g. for 47% taxpayer: +32% instant boost)
  const upfrontAlphaPercent = ((1 - superTaxRate) / (1 - marginalRate) - 1) * 100;

  // 10-Year and 20-Year snapshots
  function simulateWealth(numYears) {
    const months = numYears * 12;
    let oBal = lumpSum;
    let eBal = lumpSum;
    let sBal = grossLumpSumEquivalent * (1 - superTaxRate);
    let eCont = lumpSum;

    for (let m = 1; m <= months; m++) {
      oBal = oBal * (1 + offsetMonthlyRate) + monthlyContribution;
      eBal = eBal * (1 + effectiveMonthlyEtfRate) + monthlyContribution;
      sBal = sBal * (1 + superMonthlyRate) + monthlySuperDeposit;
      eCont += monthlyContribution;
    }
    const eGain = Math.max(0, eBal - eCont);
    const eNet = eBal - (eGain * 0.50 * marginalRate);
    return { offset: Math.round(oBal), etf: Math.round(eNet), super: Math.round(sBal) };
  }

  const snap10 = simulateWealth(10);
  const snap20 = simulateWealth(20);

  // Determine winner
  let winner = 'Super Salary Sacrifice';
  let winnerAmount = superNetWealth;
  if (offsetBalance > superNetWealth && offsetBalance > etfNetWealth) {
    winner = 'Mortgage Offset (Guaranteed Tax-Free)';
    winnerAmount = offsetBalance;
  } else if (etfNetWealth > superNetWealth && etfNetWealth > offsetBalance) {
    winner = 'ETF Portfolio';
    winnerAmount = etfNetWealth;
  }

  return {
    marginalRatePercent: Math.round(marginalRate * 100),
    superTaxRatePercent: Math.round(superTaxRate * 100),
    equivalentGrossReturn: Math.round(equivalentGrossReturn * 100) / 100,
    upfrontAlphaPercent: Math.round(upfrontAlphaPercent * 10) / 10,

    offsetNetWealth: Math.round(offsetBalance),
    etfNetWealth: Math.round(etfNetWealth),
    superNetWealth: Math.round(superNetWealth),

    cgtPaidOnExit: Math.round(cgtPaidOnExit),
    monthlySuperDeposit: Math.round(monthlySuperDeposit),

    snap10,
    snap20,
    winner,
    winnerAmount: Math.round(winnerAmount)
  };
}
