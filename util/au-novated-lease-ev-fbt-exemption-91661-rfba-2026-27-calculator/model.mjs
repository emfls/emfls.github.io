export const PARAMETERS = Object.freeze({
  lctThreshold: 91_661,
  carLimit: 69_883,
  purchaseGstCap: 6_353,
  proposedFullDiscountLimit: 75_000,
  statutoryRate: 0.20,
  proposedStatutoryRate: 0.15,
  fbtRate: 0.47,
  type1GrossUp: 2.0802,
  type2GrossUp: 1.8868,
  reportableThreshold: 2_000,
  residualRates: Object.freeze({ 3: 0.4688, 4: 0.375, 5: 0.2813 }),
});

export const DEFAULTS = Object.freeze({
  driveAway: 82_000,
  onRoad: 2_000,
  lctPaid: 0,
  vehicleType: 'bev',
  vehicleHistory: 'passes',
  years: 4,
  runningCosts: 4_200,
  gstRunningCosts: 3_000,
  salary: 102_000,
  deductions: 1_000,
  hasHelp: true,
  helpBalance: null,
  hasCover: false,
  leaseApr: 8,
  loanApr: 7.5,
  annualFee: 300,
});

export function residentTax(income) {
  const taxable = Math.max(0, income);
  const brackets = [
    [18_200, 45_000, 0.15],
    [45_000, 135_000, 0.30],
    [135_000, 190_000, 0.37],
    [190_000, Infinity, 0.45],
  ];
  const gross = brackets.reduce((tax, [lower, upper, rate]) =>
    tax + Math.max(0, Math.min(taxable, upper) - lower) * rate, 0);
  const offset = 700
    - Math.max(0, Math.min(taxable, 45_000) - 37_500) * 0.05
    - Math.max(0, taxable - 45_000) * 0.015;
  return Math.max(0, gross - Math.max(0, offset));
}

export function medicareLevy(income) {
  return Math.min(Math.max(0, income) * 0.02, Math.max(0, income - 28_011) * 0.10);
}

export function helpRepayment(income) {
  if (income <= 69_528) return 0;
  if (income <= 129_717) return (income - 69_528) * 0.15;
  if (income <= 186_050) return 9_028 + (income - 129_717) * 0.17;
  return income * 0.10;
}

export function surcharge(income, hasCover = false) {
  if (hasCover || income <= 105_000) return 0;
  if (income <= 123_000) return income * 0.01;
  if (income <= 164_000) return income * 0.0125;
  return income * 0.015;
}

export function monthlyPayment(principal, annualRate, months, balloon = 0) {
  const rate = annualRate / 1200;
  if (rate === 0) return (principal - balloon) / months;
  const logDiscount = -months * Math.log1p(rate);
  return (principal - balloon * Math.exp(logDiscount)) * rate / -Math.expm1(logDiscount);
}

export function calculate(inputs) {
  const {
    driveAway, onRoad, lctPaid, vehicleType, vehicleHistory, years, runningCosts,
    gstRunningCosts, salary, deductions, hasHelp, helpBalance, hasCover, leaseApr, loanApr, annualFee,
  } = inputs;
  const p = PARAMETERS;
  const amounts = [driveAway, onRoad, lctPaid, runningCosts, gstRunningCosts, salary, deductions, annualFee];
  if (helpBalance !== null) amounts.push(helpBalance);
  if (amounts.some((value) => !Number.isFinite(value) || value < 0 || value > 100_000_000)) {
    throw new RangeError('Enter amounts from A$0 to A$100 million.');
  }
  if (driveAway <= onRoad + lctPaid || gstRunningCosts > runningCosts) {
    throw new RangeError('On-road charges plus LCT must be less than the drive-away price. GST-creditable running costs must fit within total running costs.');
  }
  if (![3, 4, 5].includes(years) || [leaseApr, loanApr].some((rate) =>
    !Number.isFinite(rate) || rate < 0 || rate > 100)) {
    throw new RangeError('Use a 3–5 year lease term and interest rates from 0% to 100%.');
  }
  if (!['bev', 'fcev', 'phev_new', 'phev_grandfathered'].includes(vehicleType) ||
      !['passes', 'fails', 'unknown'].includes(vehicleHistory) ||
      typeof hasCover !== 'boolean' || typeof hasHelp !== 'boolean') {
    throw new RangeError('Choose a vehicle type, confirm its eligibility history and check the tax options.');
  }

  const baseValue = Math.round((driveAway - onRoad) * 100) / 100;
  const lctValue = Math.round((baseValue - lctPaid) * 100) / 100;
  const grandfathered = vehicleType === 'phev_grandfathered';
  // A continuing PHEV uses its confirmed historical eligibility, not a new purchase threshold.
  const eligibleTypeAndPrice = grandfathered || (vehicleType !== 'phev_new' && lctValue <= p.lctThreshold);
  let treatment = 'standard';
  if (eligibleTypeAndPrice && lctPaid === 0) {
    if (vehicleHistory === 'passes') treatment = 'exempt';
    if (vehicleHistory === 'unknown') treatment = 'unverified';
  }

  const months = years * 12;
  const residualRate = p.residualRates[years];
  const residual = baseValue * residualRate;
  const vehicleGst = Math.min(lctValue / 11, p.purchaseGstCap);
  const runningGst = gstRunningCosts / 11;
  const leasePayment = monthlyPayment(driveAway - vehicleGst, leaseApr, months, residual / 1.1);
  const annualPackage = leasePayment * 12 + runningCosts - runningGst + annualFee;
  const notionalValue = baseValue * p.statutoryRate;
  const rfba = notionalValue > p.reportableThreshold ? notionalValue * p.type2GrossUp : 0;

  const baseTaxableIncome = Math.max(0, salary - deductions);
  const help = (income) => hasHelp ? Math.min(helpRepayment(income), helpBalance ?? Infinity) : 0;
  const mls = (income) => surcharge(income, hasCover);
  const tax = (income) => residentTax(income) + medicareLevy(income);
  const baseHelp = help(baseTaxableIncome);
  const baseMls = mls(baseTaxableIncome);

  function packageAt(statutoryRate) {
    const employerFbt = baseValue * statutoryRate * p.type1GrossUp * p.fbtRate;
    const packageCost = annualPackage + employerFbt;
    const preTax = Math.min(salary, packageCost);
    const unpackaged = packageCost - preTax;
    const taxableIncome = Math.max(0, baseTaxableIncome - preTax);
    const incomeForTests = taxableIncome + rfba;
    const taxSavings = tax(baseTaxableIncome) - tax(taxableIncome);
    const helpWithLease = help(incomeForTests);
    const mlsWithLease = mls(incomeForTests);
    const helpDelta = helpWithLease - baseHelp;
    const mlsDelta = mlsWithLease - baseMls;
    const annualNet = packageCost - taxSavings + helpDelta + mlsDelta;
    return {
      employerFbt, preTax, unpackaged, taxableIncome, incomeForTests, taxSavings,
      helpWithLease, mlsWithLease, helpDelta, mlsDelta, annualNet,
      helpRfbaIncrease: helpWithLease - help(taxableIncome),
      mlsRfbaIncrease: mlsWithLease - mls(taxableIncome),
    };
  }

  const current = packageAt(treatment === 'exempt' ? 0 : p.statutoryRate);
  const leaseTotal = current.annualNet * years + residual;
  const loanPayment = monthlyPayment(driveAway, loanApr, months);
  const loanTotal = loanPayment * months + runningCosts * years;
  const cashTotal = driveAway + runningCosts * years;

  let taper = null;
  if (treatment === 'exempt' && !grandfathered && baseValue > p.proposedFullDiscountLimit) {
    const proposed = packageAt(p.proposedStatutoryRate);
    const annualCostIncrease = proposed.annualNet - current.annualNet;
    taper = { employerFbt: proposed.employerFbt, annualCostIncrease, termCostIncrease: annualCostIncrease * years };
  }

  return {
    treatment, baseValue, lctValue, residualRate, residual, vehicleGst, runningGst, leasePayment,
    notionalValue, rfba, baseTaxableIncome, baseHelp, baseMls, ...current,
    leaseTotal, loanPayment, loanTotal, cashTotal, loanSavings: loanTotal - leaseTotal,
    cashSavings: cashTotal - leaseTotal, taper,
  };
}
