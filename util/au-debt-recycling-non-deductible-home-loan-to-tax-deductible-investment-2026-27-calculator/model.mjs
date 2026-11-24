export const marginalTaxRates = Object.freeze([0.32, 0.39, 0.47]);

export const defaults = Object.freeze({
  balance: 600000,
  initial: 100000,
  savings: 18000,
  rate: 6,
  tax: 39,
  yield: 4,
  franking: 50,
  growth: 3,
  years: 15,
  term: 25,
});

const bounds = {
  balance: [1, 100000000],
  initial: [0, 100000000],
  savings: [0, 100000000],
  rate: [0, 30],
  yield: [0, 30],
  franking: [0, 100],
  growth: [-100, 100],
  years: [1, 50],
  term: [1, 50],
};

export function distributionTax(dividends, frankedShare, taxRate) {
  const credit = dividends * frankedShare * (0.30 / 0.70);
  const assessable = dividends + credit;
  const tax = assessable * taxRate - credit;
  return { credit, assessable, tax, net: dividends - tax };
}

export function simulate(inputs = defaults) {
  const values = { ...defaults, ...inputs };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = values[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${key} must be between ${min} and ${max}.`);
    }
  }
  const { balance, initial, savings, years, term } = values;
  if (!Number.isInteger(years) || !Number.isInteger(term)) {
    throw new RangeError('Projection and mortgage terms must be whole years.');
  }
  const taxRate = values.tax / 100;
  if (!marginalTaxRates.includes(taxRate)) {
    throw new RangeError('Choose a marginal rate of 32%, 39% or 47%.');
  }
  const rate = values.rate / 100;
  const dividendYield = values.yield / 100;
  const frankedShare = values.franking / 100;
  const growth = values.growth / 100;
  const payment = rate === 0
    ? balance / term
    : balance * rate / -Math.expm1(-term * Math.log1p(rate));

  const recycle = { privateDebt: balance, investmentDebt: 0, converted: 0, portfolio: 0, cash: 0 };
  const direct = { privateDebt: balance, portfolio: initial, cash: 0 };
  const offset = { privateDebt: balance, cash: initial };
  const rows = [];
  let cumulativeTaxSavings = 0;
  let privateDebtClearedYear = null;
  const epsilon = balance * 1e-12;

  function investByRecycling(amount) {
    const converted = Math.min(recycle.privateDebt, amount);
    recycle.privateDebt -= converted;
    recycle.investmentDebt += converted;
    recycle.converted += converted;
    // Cash beyond the available private split is invested without borrowing.
    recycle.portfolio += amount;
  }

  function payPrincipal(strategy, interest) {
    let available = Math.max(0, payment - interest);
    const privatePayment = Math.min(strategy.privateDebt, available);
    strategy.privateDebt -= privatePayment;
    available -= privatePayment;
    if (strategy.investmentDebt !== undefined) {
      const investmentPayment = Math.min(strategy.investmentDebt, available);
      strategy.investmentDebt -= investmentPayment;
      available -= investmentPayment;
    }
    strategy.cash += available;
  }

  investByRecycling(initial);
  // Once offset cash covers the loan, interest stays zero while those funds remain deposited.
  for (let year = 1; year <= years; year += 1) {
    investByRecycling(savings);
    direct.portfolio += savings;
    offset.cash += savings;

    if (recycle.privateDebt <= epsilon && privateDebtClearedYear === null) {
      privateDebtClearedYear = year - 1;
    }

    const openingInvestmentDebt = recycle.investmentDebt;
    const investmentInterest = openingInvestmentDebt * rate;
    const annualTaxSavings = investmentInterest * taxRate;
    cumulativeTaxSavings += annualTaxSavings;
    const offsetInterest = Math.max(0, offset.privateDebt - offset.cash) * rate;
    const offsetInterestSaved = offset.privateDebt * rate - offsetInterest;
    payPrincipal(recycle, recycle.privateDebt * rate + investmentInterest);
    payPrincipal(direct, direct.privateDebt * rate);
    payPrincipal(offset, offsetInterest);

    const recycleDividends = recycle.portfolio * dividendYield;
    const directDividends = direct.portfolio * dividendYield;
    const recycleDistribution = distributionTax(recycleDividends, frankedShare, taxRate);
    const directDistribution = distributionTax(directDividends, frankedShare, taxRate);
    recycle.portfolio *= 1 + growth;
    direct.portfolio = direct.portfolio * (1 + growth) + directDistribution.net;
    investByRecycling(recycleDistribution.net + annualTaxSavings);

    if (recycle.privateDebt <= epsilon && privateDebtClearedYear === null) {
      privateDebtClearedYear = year;
    }

    const recycleWealth = recycle.portfolio + recycle.cash - recycle.privateDebt - recycle.investmentDebt;
    const directWealth = direct.portfolio + direct.cash - direct.privateDebt;
    const offsetWealth = offset.cash - offset.privateDebt;
    rows.push({
      year,
      openingInvestmentDebt,
      investmentInterest,
      annualTaxSavings,
      cumulativeTaxSavings,
      recycleDividends,
      recycleFrankingCredit: recycleDistribution.credit,
      recycleNetDividends: recycleDistribution.net,
      privateDebt: recycle.privateDebt,
      investmentDebt: recycle.investmentDebt,
      converted: recycle.converted,
      convertedShare: Math.min(1, recycle.converted / balance),
      offsetInterestSaved,
      recycleWealth,
      directWealth,
      offsetWealth,
      advantageOverDirect: recycleWealth - directWealth,
    });
  }

  return {
    rows,
    final: rows[rows.length - 1],
    payment,
    effectiveRate: rate * (1 - taxRate),
    offsetPreTaxRate: rate / (1 - taxRate),
    privateDebtClearedYear,
    yearsShaved: privateDebtClearedYear === null ? null : Math.max(0, term - privateDebtClearedYear),
  };
}
