export const priceCaps = Object.freeze({
  sydney: 1300000,
  melbourne: 950000,
  brisbane: 1000000,
  adelaide: 900000,
  perth: 850000,
  act: 1000000,
  hobart: 700000,
  darwin: 600000,
  'nsw-other': 800000,
  'vic-other': 650000,
  'qld-other': 700000,
  'sa-other': 500000,
  'wa-other': 600000,
  'tas-other': 550000,
  'external-550': 550000,
  'external-400': 400000
});

const incomeCaps = {
  indexed: { single: 103000, joint: 165000, 'single-parent': 165000 },
  prior: { single: 100000, joint: 160000, 'single-parent': 160000 }
};
const equityRates = { existing: 0.3, new: 0.4 };
const termMonths = 360;

function validateNumber(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
}

function lookup(values, key, name) {
  if (!Object.hasOwn(values, key)) throw new RangeError(`Select a valid ${name}.`);
  return values[key];
}

export function mortgage(principal, rate, months) {
  validateNumber(principal, 0, 1e9, 'Loan principal');
  validateNumber(rate, 0, 30, 'Mortgage rate');
  validateNumber(months, 0, termMonths, 'Months held');
  if (!Number.isInteger(months)) throw new RangeError('Use whole months.');

  const monthlyRate = rate / 1200;
  if (monthlyRate === 0) {
    return { principal, monthly: principal / termMonths, balance: principal * (termMonths - months) / termMonths, interest: 0 };
  }

  const logFactor = Math.log1p(monthlyRate);
  const monthly = principal * (monthlyRate / -Math.expm1(-termMonths * logFactor));
  const balance = monthly * (-Math.expm1(-(termMonths - months) * logFactor) / monthlyRate);
  const interest = Math.max(0, monthly * months - (principal - balance));
  return { principal, monthly, balance, interest };
}

export function calculate({
  price, region, household, income, incomeYear, home, depositRate,
  mortgageRate, lmiRate, lmiPayment, holdingYears, growthRate
}) {
  const priceCap = lookup(priceCaps, region, 'location');
  const incomeCap = lookup(lookup(incomeCaps, incomeYear, 'income threshold year'), household, 'applicant type');
  const govEquityRate = lookup(equityRates, home, 'property type');
  const financeLmi = lookup({ financed: true, cash: false }, lmiPayment, 'LMI payment option');

  validateNumber(price, 1, 100000000, 'Purchase price');
  validateNumber(income, 0, 100000000, 'Taxable income');
  validateNumber(depositRate, 0, 100 * (1 - govEquityRate), 'Help to Buy deposit percentage');
  validateNumber(lmiRate, 0, 10, 'LMI estimate percentage');
  validateNumber(holdingYears, 0, 30, 'Holding period');
  validateNumber(growthRate, -99, 30, 'Annual price growth');

  const months = Math.round(holdingYears * 12);
  if (Math.abs(months - holdingYears * 12) > 1e-8) throw new RangeError('Use a holding period in whole months.');

  const checks = { price: price <= priceCap, income: income <= incomeCap, deposit: depositRate >= 2 };
  const eligible = checks.price && checks.income && checks.deposit;
  const deposit = price * depositRate / 100;
  const govEquity = price * govEquityRate;
  const help = mortgage(Math.max(0, price - deposit - govEquity), mortgageRate, months);
  const futureHomeValue = price * (1 + growthRate / 100) ** (months / 12);
  const govBuyoutPayout = futureHomeValue * govEquityRate;
  const govCapitalGainShare = govBuyoutPayout - govEquity;
  const lmiAvoided = price * 0.95 * lmiRate / 100;

  function compare(standardDeposit, premium) {
    const upfront = standardDeposit + (financeLmi ? 0 : premium);
    const loan = mortgage(price - standardDeposit + (financeLmi ? premium : 0), mortgageRate, months);
    const interestSaved = loan.interest - help.interest;
    return {
      ...loan,
      deposit: standardDeposit,
      premium,
      upfront,
      upfrontSaved: upfront - deposit,
      monthlySaved: loan.monthly - help.monthly,
      interestSaved,
      net: interestSaved + premium - govCapitalGainShare
    };
  }

  return {
    checks, eligible, priceCap, incomeCap, deposit, govEquityRate, govEquity, help,
    five: compare(price * 0.05, lmiAvoided),
    twenty: compare(price * 0.2, 0),
    months, lmiAvoided, futureHomeValue, govBuyoutPayout, govCapitalGainShare
  };
}
