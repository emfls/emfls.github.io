const CURRENT = '2026_27_current';
const HIKED = '2027_28_hiked';
const bands = {
  basic: { psa: 1000, current: 0.20, hiked: 0.24 },
  higher: { psa: 500, current: 0.40, hiked: 0.44 },
  additional: { psa: 0, current: 0.45, hiked: 0.49 },
};

export function taxParameters(regime, band) {
  if (![CURRENT, HIKED].includes(regime) || !Object.hasOwn(bands, band)) {
    throw new RangeError('Choose a valid tax year and savings tax band.');
  }

  const { psa, current, hiked } = bands[band];
  return { psa, rate: regime === CURRENT ? current : hiked };
}

export function monthlyPayment(balance, annualRate, months) {
  const rate = annualRate / 1200;
  if (rate === 0) return balance / months;
  return balance * rate / -Math.expm1(-months * Math.log1p(rate));
}

function validate(input) {
  const ranges = {
    balance: [1, 100000000],
    years: [1 / 12, 50],
    mortgageRate: [0, 100],
    lump: [0, 100000000],
    extra: [0, 100000000],
    isaRate: [0, 100],
    savingsRate: [0, 100],
    existingInterest: [0, 100000000],
    capRate: [0, 100],
    ercRate: [0, 100],
    usedOverpayment: [0, 100000000],
    usedIsa: [0, 20000],
    usedCashIsa: [0, input.usedIsa],
  };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) {
      throw new RangeError(`Invalid value for ${key}.`);
    }
  }
  if (typeof input.age65 !== 'boolean') throw new RangeError('Choose a Cash ISA age group.');
}

function amortise(input, months, payment) {
  let balance = input.balance;
  let interest = 0;
  let payoffMonths = 0;
  const years = [];
  for (let start = 0; start < months; start += 12) {
    let allowance = Math.max(0, balance * input.capRate / 100 - (start === 0 ? input.usedOverpayment : 0));
    const year = { allowanceBeforePlan: allowance, excess: 0, erc: 0 };
    function overpay(requested) {
      const amount = Math.min(balance, requested);
      year.excess += Math.max(0, amount - allowance);
      allowance = Math.max(0, allowance - amount);
      balance -= amount;
    }

    if (start === 0) overpay(input.lump);
    for (let month = start; month < Math.min(start + 12, months) && balance > 1e-7; month++) {
      const charge = balance * input.mortgageRate / 1200;
      interest += charge;
      balance = Math.max(0, balance + charge - payment);
      overpay(input.extra);
      payoffMonths = month + 1;
    }
    year.allowanceRemaining = allowance;
    year.erc = year.excess * input.ercRate / 100;
    years.push(year);
    if (balance <= 1e-7) break;
  }

  return { interest, payoffMonths, years };
}

function savings(input, months, useIsa, annualSavingsRate) {
  const isaMonthly = Math.expm1(Math.log1p(input.isaRate / 100) / 12);
  const taxableMonthly = Math.expm1(Math.log1p(annualSavingsRate / 100) / 12);
  let tax = 0;
  let isa = 0;
  let taxable = 0;
  let totalIsaContributions = 0;
  let firstYear;

  for (let start = 0; start < months; start += 12) {
    const regime = start === 0 ? input.regime : HIKED;
    const { psa, rate } = taxParameters(regime, input.band);
    // Existing non-ISA interest is a recurring annual estimate.
    const availablePsa = Math.max(0, psa - input.existingInterest);
    const cashLimit = regime === CURRENT || input.age65 ? 20000 : 12000;
    const usedIsa = start === 0 ? input.usedIsa : 0;
    const usedCashIsa = start === 0 ? input.usedCashIsa : 0;
    const isaRoom = Math.max(0, Math.min(cashLimit - usedCashIsa, 20000 - usedIsa));
    let isaContributions = 0;
    let isaOverflow = 0;
    let taxableInterest = 0;

    function deposit(amount) {
      const sheltered = useIsa ? Math.min(amount, isaRoom - isaContributions) : 0;
      isaContributions += sheltered;
      isaOverflow += amount - sheltered;
      isa += sheltered;
      taxable += amount - sheltered;
    }

    if (start === 0) deposit(input.lump);
    for (let month = start; month < Math.min(start + 12, months); month++) {
      isa += isa * isaMonthly;
      const interest = taxable * taxableMonthly;
      taxable += interest;
      taxableInterest += interest;
      deposit(input.extra);
    }
    const yearTax = Math.max(0, taxableInterest - availablePsa) * rate;
    taxable -= yearTax;
    tax += yearTax;
    totalIsaContributions += isaContributions;
    if (start === 0) firstYear = { isaRoom, isaContributions, isaOverflow, availablePsa };
  }
  return { wealth: isa + taxable, tax, totalIsaContributions, firstYear };
}

function scenarioHurdle(input, months, target) {
  if (input.lump + input.extra === 0) return null;
  if (target <= input.lump + input.extra * months) return 0;
  const wealthAt = rate => savings(input, months, false, rate).wealth;
  if (wealthAt(100) < target) return null;

  let floor = 0;
  let ceiling = 100;
  for (let i = 0; i < 45; i++) {
    const midpoint = (floor + ceiling) / 2;
    if (wealthAt(midpoint) >= target) ceiling = midpoint;
    else floor = midpoint;
  }
  return ceiling;
}

export function compare(input) {
  validate(input);
  const { rate } = taxParameters(input.regime, input.band);
  const termMonths = Math.round(input.years * 12);
  const payment = monthlyPayment(input.balance, input.mortgageRate, termMonths);
  const baselineInterest = amortise({ ...input, lump: 0, extra: 0 }, termMonths, payment).interest;
  const mortgage = amortise(input, termMonths, payment);
  const interestSaved = Math.max(0, baselineInterest - mortgage.interest);
  const totalErc = mortgage.years.reduce((total, year) => total + year.erc, 0);
  const budget = input.lump + input.extra * termMonths;

  // With both mortgages cleared at the comparison date, interest savings are
  // the difference in cash spent. Unspent payments earn 0% on this route.
  const mortgageWealth = budget + interestSaved - totalErc;
  const isa = savings(input, termMonths, true, input.savingsRate);
  const taxable = savings(input, termMonths, false, input.savingsRate);
  const routes = [
    ['Overpay Mortgage', mortgageWealth],
    ['Cash ISA', isa.wealth],
    ['Taxable Savings', taxable.wealth],
  ];
  const highest = Math.max(...routes.map(([, wealth]) => wealth));
  const winners = routes.filter(([, wealth]) => highest - wealth < 0.005).map(([name]) => name);
  const effectiveMortgageRate = Math.expm1(12 * Math.log1p(input.mortgageRate / 1200)) * 100;

  return {
    payment, termMonths, payoffMonths: mortgage.payoffMonths,
    monthsSaved: termMonths - mortgage.payoffMonths, baselineInterest, interestSaved,
    totalErc, ercYears: mortgage.years, budget, mortgageWealth, winners,
    isaWealth: isa.wealth, isaTax: isa.tax, isaContributions: isa.totalIsaContributions,
    taxableWealth: taxable.wealth, taxableTax: taxable.tax,
    firstYear: { ...mortgage.years[0], ...isa.firstYear },
    nominalTaxableHurdle: input.mortgageRate / (1 - rate),
    fullyTaxedAerHurdle: effectiveMortgageRate / (1 - rate),
    scenarioTaxableAer: scenarioHurdle(input, termMonths, mortgageWealth),
  };
}
