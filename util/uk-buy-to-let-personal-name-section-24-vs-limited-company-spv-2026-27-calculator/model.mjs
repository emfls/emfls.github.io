const BASIC_BAND = 37_700;
const ADDITIONAL_THRESHOLD = 125_140;
const DIVIDEND_ALLOWANCE = 500;
const FINANCE_RELIEF_RATE = 0.20;
const YEARS = 10;

export const STRATEGIES = Object.freeze({
  EXTRACT: 'EXTRACT_ALL_DIVIDENDS',
  RETAIN: 'RETAIN_IN_SPV_COMPOUNDING'
});

export function personalAllowance(adjustedNetIncome) {
  return Math.max(0, 12_570 - Math.max(0, adjustedNetIncome - 100_000) / 2);
}

function taxSlice(bottom, top, bandStart, bandEnd) {
  return Math.max(0, Math.min(top, bandEnd) - Math.max(bottom, bandStart));
}

function bandTax(bottom, top, [basic, higher, additional]) {
  return taxSlice(bottom, top, 0, BASIC_BAND) * basic
    + taxSlice(bottom, top, BASIC_BAND, ADDITIONAL_THRESHOLD) * higher
    + taxSlice(bottom, top, ADDITIONAL_THRESHOLD, Infinity) * additional;
}

export function incomeTax(income, allowance = personalAllowance(income)) {
  return bandTax(0, Math.max(0, income - allowance), [0.20, 0.40, 0.45]);
}

// Incremental household tax includes any allowance lost on the existing income.
export function dividendTax(otherIncome, dividend) {
  const allowance = personalAllowance(otherIncome + dividend);
  const taxableOther = Math.max(0, otherIncome - allowance);
  const taxableTotal = Math.max(0, otherIncome + dividend - allowance);
  const dividendsDue = bandTax(taxableOther + DIVIDEND_ALLOWANCE, taxableTotal,
    [0.1075, 0.3575, 0.3935]);
  return incomeTax(otherIncome, allowance) - incomeTax(otherIncome) + dividendsDue;
}

export function corporationTax(profit) {
  if (profit <= 0) return 0;
  if (profit <= 50_000) return profit * 0.19;
  if (profit >= 250_000) return profit * 0.25;
  return profit * 0.25 - (250_000 - profit) * 3 / 200;
}

function effectiveRate(tax, profit) {
  return profit > 0 ? tax / profit * 100 : null;
}

function personalResult(netRent, interest, otherIncome) {
  const taxableProfit = Math.max(0, netRent);
  const combinedIncome = otherIncome + taxableProfit;
  const eligibleIncome = Math.max(0, combinedIncome - personalAllowance(combinedIncome));
  const financeCredit = Math.min(interest, taxableProfit, eligibleIncome) * FINANCE_RELIEF_RATE;
  const tax = Math.max(0, incomeTax(combinedIncome) - incomeTax(otherIncome) - financeCredit);
  const economicProfit = netRent - interest;
  return {
    interest, taxableProfit, financeCredit, tax, economicProfit,
    pocketCash: economicProfit - tax,
    effectiveTaxRate: effectiveRate(tax, economicProfit)
  };
}

function companyResults(economicProfit, interest, otherIncome) {
  const taxableProfit = Math.max(0, economicProfit);
  const companyTax = corporationTax(taxableProfit);
  const afterTax = economicProfit - companyTax;
  const ownerTax = dividendTax(otherIncome, Math.max(0, afterTax));
  return {
    extract: {
      interest, taxableProfit, economicProfit, corporationTax: companyTax, dividendTax: ownerTax,
      pocketCash: afterTax - ownerTax, companyCash: 0,
      effectiveTaxRate: effectiveRate(companyTax + ownerTax, economicProfit)
    },
    retain: {
      interest, taxableProfit, economicProfit, corporationTax: companyTax, dividendTax: 0,
      pocketCash: Math.min(0, afterTax), companyCash: Math.max(0, afterTax),
      effectiveTaxRate: effectiveRate(companyTax, economicProfit)
    }
  };
}

// The same accumulation rule for each route preserves the ordering of annual cash flows.
function breakEvenRate({ loanAmount, personalRate, operatingProfit, otherIncome, route, target }) {
  if (loanAmount === 0) return { status: 'no-mortgage' };
  const annualCash = rate => {
    const result = companyResults(operatingProfit - loanAmount * rate / 100, 0, otherIncome)[route];
    return result.pocketCash + result.companyCash;
  };
  const cashAtZero = annualCash(0);
  if (cashAtZero < target) return { status: 'never' };
  if (cashAtZero === target) return { status: 'tie-at-zero', rate: 0, spread: -personalRate };

  // Cash is strictly decreasing with the rate. At break-even with a nonpositive
  // target, company cash has no Corporation Tax or dividend tax to invert.
  let rate = (operatingProfit - target) / loanAmount * 100;
  if (target > 0) {
    let low = 0;
    let high = operatingProfit / loanAmount * 100;
    for (let iteration = 0; iteration < 60; iteration++) {
      const middle = (low + high) / 2;
      if (annualCash(middle) > target) low = middle;
      else high = middle;
    }
    rate = (low + high) / 2;
  }
  return { status: 'threshold', rate, spread: rate - personalRate };
}

function validateRange(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
}

export function compare({
  propertyValue, loanToValue, personalRate, spvRate, grossRent, operatingCosts,
  spvFee, otherIncome, growthRate, strategy
}) {
  validateRange('Property value', propertyValue, 1, 100_000_000);
  for (const [label, value] of Object.entries({
    'Loan-to-value': loanToValue, 'Personal rate': personalRate,
    'SPV rate': spvRate, 'Growth rate': growthRate
  })) validateRange(label, value, 0, 100);

  for (const [label, value] of Object.entries({
    'Annual rent': grossRent, 'Operating costs': operatingCosts,
    'Company fees': spvFee, 'Other income': otherIncome
  })) validateRange(label, value, 0, 100_000_000);

  if (!Object.values(STRATEGIES).includes(strategy)) throw new RangeError('Choose an SPV strategy.');
  const route = strategy === STRATEGIES.EXTRACT ? 'extract' : 'retain';
  const loanAmount = propertyValue * loanToValue / 100;
  const netRent = grossRent - operatingCosts;
  const companyOperatingProfit = netRent - spvFee;
  const personal = personalResult(netRent, loanAmount * personalRate / 100, otherIncome);
  const spvInterest = loanAmount * spvRate / 100;
  const { extract, retain } = companyResults(companyOperatingProfit - spvInterest, spvInterest, otherIncome);

  const annualCash = {
    personal: personal.pocketCash,
    extract: extract.pocketCash,
    retain: retain.pocketCash + retain.companyCash
  };
  const balances = { personal: 0, extract: 0, retain: 0 };
  const years = Array.from({ length: YEARS }, (_, index) => {
    for (const key of Object.keys(balances)) {
      balances[key] += Math.max(0, balances[key]) * growthRate / 100 + annualCash[key];
    }
    return { year: index + 1, ...balances };
  });

  return {
    loanAmount, currentSpread: spvRate - personalRate,
    personal: { ...personal, endingWealth: balances.personal },
    extract: { ...extract, endingWealth: balances.extract },
    retain: { ...retain, endingWealth: balances.retain },
    years, route,
    wealthAdvantage: balances[route] - balances.personal,
    breakEven: breakEvenRate({
      loanAmount, personalRate, operatingProfit: companyOperatingProfit, otherIncome,
      route, target: annualCash.personal
    })
  };
}
