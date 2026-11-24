const ANNUAL_CAP = 10_000;
const FIRST_TAX_YEAR = 2025;
const LAST_TAX_YEAR = 2028;
const RATES = [10, 12, 22, 24, 32, 35, 37];

// Upper bounds for the first six 2026 ordinary-income brackets (Rev. Proc. 2025-32).
const TAX = {
  single: { standard: 16_100, upper: [12_400, 50_400, 105_700, 201_775, 256_225, 640_600] },
  hoh: { standard: 24_150, upper: [17_700, 67_450, 105_700, 201_750, 256_200, 640_600] },
  mfs: { standard: 16_100, upper: [12_400, 50_400, 105_700, 201_775, 256_225, 384_350] },
  mfj: { standard: 32_200, upper: [24_800, 100_800, 211_400, 403_550, 512_450, 768_700] },
};

function taxParameters(status) {
  if (!Object.hasOwn(TAX, status)) throw new RangeError('Choose a supported filing status.');
  return TAX[status];
}

export function standardDeduction(status) {
  return taxParameters(status).standard;
}

export function marginalRate(status, taxableIncome) {
  const { upper } = taxParameters(status);
  if (!Number.isFinite(taxableIncome)) throw new RangeError('Enter a finite taxable income.');
  const bracket = upper.findIndex(limit => taxableIncome <= limit);
  return RATES[bracket === -1 ? RATES.length - 1 : bracket];
}

function taxBetween(status, lowerIncome, upperIncome) {
  const { upper } = taxParameters(status);
  return RATES.reduce((tax, rate, i) => {
    const bottom = Math.max(lowerIncome, upper[i - 1] ?? 0);
    const top = Math.min(upperIncome, upper[i] ?? Infinity);
    return tax + Math.max(0, top - bottom) * (rate / 100);
  }, 0);
}

export function federalTax(status, taxableIncome) {
  if (!Number.isFinite(taxableIncome)) throw new RangeError('Enter a finite taxable income.');
  return taxBetween(status, 0, taxableIncome);
}

export function phaseOut(status, magi) {
  taxParameters(status);
  if (!Number.isFinite(magi)) throw new RangeError('Enter a finite MAGI.');
  const threshold = status === 'mfj' ? 200_000 : 100_000;
  const reduction = Math.min(ANNUAL_CAP, 200 * Math.ceil(Math.max(0, magi - threshold) / 1_000));
  return { reduction, maxDeduction: ANNUAL_CAP - reduction };
}

export function deductionForInterest(interest, status, magi) {
  if (!Number.isFinite(interest) || interest < 0) throw new RangeError('Enter nonnegative interest.');
  // Treasury Regulation § 1.163-16(h) reduces the otherwise deductible interest.
  return Math.max(0, Math.min(interest, ANNUAL_CAP) - phaseOut(status, magi).reduction);
}

function monthIndex(startMonth) {
  const match = typeof startMonth === 'string' && /^(\d{4})-(0[1-9]|1[0-2])$/.exec(startMonth);
  if (!match || Number(match[1]) < 1900 || Number(match[1]) > 2100) {
    throw new RangeError('Choose an origination month from January 1900 to December 2100.');
  }
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function amortize({ loanAmount, apr, termMonths, startMonth }) {
  if (!Number.isFinite(loanAmount) || loanAmount < 0.01 || loanAmount > 10_000_000) {
    throw new RangeError('Enter a loan amount from $0.01 to $10,000,000.');
  }
  if (!Number.isFinite(apr) || apr < 0 || apr > 100) {
    throw new RangeError('Enter an APR from 0% to 100%.');
  }
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) {
    throw new RangeError('Enter a whole-number term from 1 to 120 months.');
  }
  const origination = monthIndex(startMonth);
  const rate = apr / 1200;
  const discount = Math.log1p(rate);
  const monthlyPayment = rate === 0
    ? loanAmount / termMonths
    : loanAmount * (rate / -Math.expm1(-termMonths * discount));
  const payments = [];
  let balance = loanAmount;

  for (let period = 1; period <= termMonths; period++) {
    const remaining = termMonths - period;
    const interest = balance * rate;
    // The present value of remaining payments keeps the ending balance stable.
    const nextBalance = rate === 0
      ? monthlyPayment * remaining
      : monthlyPayment * (-Math.expm1(-remaining * discount) / rate);
    const principal = balance - nextBalance;
    const month = origination + period;
    payments.push({
      period, year: Math.floor(month / 12), month: month % 12 + 1,
      interest, principal, balance: nextBalance, payment: principal + interest,
    });
    balance = nextBalance === 0 ? 0 : nextBalance;
  }
  // Math.expm1 can produce a signed zero on the last payment.
  payments.at(-1).balance = 0;
  return { monthlyPayment, payments };
}

function effectiveApr(apr, loanAmount, payments, rebates) {
  if (rebates.length === 0) return apr;
  let low = 0;
  let high = apr / 1200;
  for (let i = 0; i < 48; i++) {
    const rate = (low + high) / 2;
    const paymentPV = payments.reduce((sum, row) => sum + row.payment / (1 + rate) ** row.period, 0);
    const rebatePV = rebates.reduce((sum, row) => sum + row.amount / (1 + rate) ** row.period, 0);
    if (paymentPV - rebatePV > loanAmount) low = rate;
    else high = rate;
  }
  return (low + high) / 2 * 1200;
}

export function calculate(options) {
  const { apr, loanAmount, startMonth, magi, filingStatus } = options;
  const { monthlyPayment, payments } = amortize(options);
  const { reduction, maxDeduction } = phaseOut(filingStatus, magi);
  const origination = monthIndex(startMonth);
  const taxableIncome = Math.max(0, magi - standardDeduction(filingStatus));
  const disqualifications = [];
  if (origination < FIRST_TAX_YEAR * 12) disqualifications.push('The loan must originate after December 31, 2024.');
  if (!options.newVehicle) disqualifications.push('The original use must begin with you on a new vehicle purchase. Used purchases and leases are ineligible.');
  if (!options.personalUse) disqualifications.push('The vehicle must be expected to serve personal use more than 50% of the time.');
  if (!options.usAssembly) disqualifications.push('Verify final assembly in the United States using the VIN or vehicle label.');
  if (!options.qualifyingVehicle) disqualifications.push('The vehicle must be an eligible road vehicle with GVWR under 14,000 pounds.');
  if (!options.firstLien) disqualifications.push('The purchase loan must be secured by a first lien on the vehicle.');

  const interestByYear = new Map();
  for (const { year, interest } of payments) {
    interestByYear.set(year, (interestByYear.get(year) ?? 0) + interest);
  }

  const years = [];
  const rebates = [];
  for (let year = FIRST_TAX_YEAR; year <= LAST_TAX_YEAR; year++) {
    const interest = interestByYear.get(year) ?? 0;
    const deduction = disqualifications.length ? 0 : deductionForInterest(interest, filingStatus, magi);
    const taxSavings = taxBetween(filingStatus, taxableIncome - deduction, taxableIncome);
    years.push({ year, interest, deduction, taxSavings });
    if (taxSavings > 0) rebates.push({ amount: taxSavings, period: year * 12 + 11 - origination });
  }

  const totalInterest = payments.reduce((sum, row) => sum + row.interest, 0);
  const outsideWindowInterest = payments.reduce((sum, row) =>
    sum + (row.year < FIRST_TAX_YEAR || row.year > LAST_TAX_YEAR ? row.interest : 0), 0);
  const totalTaxSavings = rebates.reduce((sum, row) => sum + row.amount, 0);
  return {
    years, monthlyPayment, totalInterest, outsideWindowInterest, totalTaxSavings, disqualifications,
    reduction, maxDeduction, taxableIncome, marginalRate: marginalRate(filingStatus, taxableIncome),
    netInterest: totalInterest - totalTaxSavings,
    afterTaxApr: effectiveApr(apr, loanAmount, payments, rebates),
  };
}
