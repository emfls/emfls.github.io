export const defaults = Object.freeze({
  years: 15,
  homePrice: 780000,
  homeDeposit: 156000,
  homeCosts: 31000,
  fhb: false,
  fhbRelief: 28000,
  homeRate: 5.75,
  homeGrowth: 4,
  homeAnnualCosts: 6500,
  weeklyRent: 620,
  rentGrowth: 3,
  ipPrice: 570000,
  ipDeposit: 114000,
  ipCosts: 24000,
  ipRate: 6.1,
  ipGrowth: 3.8,
  ipYield: 5,
  vacancy: 3,
  ipAnnualCosts: 8500,
  rentalGrowth: 3,
  div43: 4500,
  div43Years: 40,
  taxRate: 39,
  portfolioReturn: 5,
  expenseGrowth: 2.5,
  saleCosts: 2.5
});

const loanMonths = 360;
const fraction = percent => percent / 100;

function inRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

function validate(input) {
  for (const [key, label] of Object.entries({
    homePrice: 'PPOR price', ipPrice: 'Investment property price'
  })) inRange(input[key], 1, 1e9, label);
  inRange(input.homeDeposit, 0, input.homePrice, 'PPOR deposit');
  inRange(input.ipDeposit, 0, input.ipPrice, 'Investment deposit');
  for (const [key, label] of Object.entries({
    homeCosts: 'PPOR buying costs', fhbRelief: 'Duty concession',
    ipCosts: 'Investment buying costs', weeklyRent: 'Weekly rent',
    homeAnnualCosts: 'PPOR ownership costs', ipAnnualCosts: 'Rental operating expenses',
    div43: 'Annual Division 43 deduction'
  })) inRange(input[key], 0, 1e9, label);
  for (const [key, label] of Object.entries({
    homeRate: 'PPOR mortgage rate', ipRate: 'Investment mortgage rate',
    ipYield: 'Gross rental yield', vacancy: 'Vacancy', saleCosts: 'Selling cost rate'
  })) inRange(input[key], 0, 100, label);
  for (const [key, label] of Object.entries({
    homeGrowth: 'PPOR growth', ipGrowth: 'Investment property growth',
    rentGrowth: 'Personal rent growth', rentalGrowth: 'Tenant rent growth',
    expenseGrowth: 'Operating cost growth'
  })) inRange(input[key], -99.99, 100, label);
  inRange(input.portfolioReturn, -100, 100, 'Portfolio return');
  inRange(input.years, 1, 30, 'Projection years');
  inRange(input.div43Years, 0, 40, 'Remaining deduction years');
  if (!Number.isInteger(input.years) || !Number.isInteger(input.div43Years)) {
    throw new RangeError('Enter whole numbers for projection and deduction years.');
  }
  if (![32, 39, 47].includes(input.taxRate)) {
    throw new RangeError('Choose a marginal rate of 32%, 39% or 47%.');
  }
  if (typeof input.fhb !== 'boolean' || (input.fhb && input.fhbRelief > input.homeCosts)) {
    throw new RangeError('The enabled duty concession cannot exceed PPOR buying costs.');
  }
  if (input.div43 * input.div43Years > input.ipPrice) {
    throw new RangeError('Total scheduled Division 43 deductions cannot exceed the investment purchase price.');
  }
}

function loanSchedule(principal, percent, years) {
  const rate = fraction(percent) / 12;
  const logRate = Math.log1p(rate);
  const discount = months => -Math.expm1(-months * logRate);
  const denominator = discount(loanMonths);
  const payment = denominator === 0 ? principal / loanMonths : principal * (rate / denominator);
  const schedule = [];
  let balance = principal;
  for (let year = 1; year <= years; year++) {
    let interest = 0;
    for (let month = 1; month <= 12; month++) {
      interest += balance * rate;
      const remaining = loanMonths - ((year - 1) * 12 + month);
      const share = denominator === 0 ? remaining / loanMonths : discount(remaining) / denominator;
      balance = principal * share;
    }
    schedule.push({ balance, interest, repayments: payment * 12 });
  }
  return schedule;
}

function grow(value, rate, years) {
  return value * (1 + fraction(rate)) ** years;
}

export function simulate(input = defaults) {
  validate(input);
  const homeCost = input.homeDeposit + input.homeCosts - (input.fhb ? input.fhbRelief : 0);
  const ipCost = input.ipDeposit + input.ipCosts;
  const initialCash = Math.max(homeCost, ipCost);
  const initial = {
    homeCost, ipCost, matchedCash: initialCash,
    homePortfolio: initialCash - homeCost,
    ipPortfolio: initialCash - ipCost
  };
  const homeSchedule = loanSchedule(input.homePrice - input.homeDeposit, input.homeRate, input.years);
  const ipSchedule = loanSchedule(input.ipPrice - input.ipDeposit, input.ipRate, input.years);
  const taxRate = fraction(input.taxRate);
  const sellingRate = fraction(input.saleCosts);
  const rows = [];
  let homePortfolio = initial.homePortfolio;
  let ipPortfolio = initial.ipPortfolio;
  let cumulativeRefunds = 0;
  let cumulativeDiv43 = 0;

  for (let year = 1; year <= input.years; year++) {
    const elapsed = year - 1;
    const home = homeSchedule[elapsed];
    const ip = ipSchedule[elapsed];
    const homeCash = home.repayments + grow(input.homeAnnualCosts, input.expenseGrowth, elapsed);
    const rentPaid = grow(input.weeklyRent * 52, input.rentGrowth, elapsed);
    const rentReceived = grow(input.ipPrice * fraction(input.ipYield) * (1 - fraction(input.vacancy)),
      input.rentalGrowth, elapsed);
    const operatingExpenses = grow(input.ipAnnualCosts, input.expenseGrowth, elapsed);
    const netRentalIncome = rentReceived - operatingExpenses;
    const div43 = year <= input.div43Years ? input.div43 : 0;
    const rentalTaxable = netRentalIncome - ip.interest - div43;
    const rentalTax = rentalTaxable * taxRate;
    const refund = Math.max(0, -rentalTax);
    cumulativeRefunds += refund;
    cumulativeDiv43 += div43;
    const rentvestCash = rentPaid + ip.repayments - netRentalIncome + rentalTax;

    homePortfolio = grow(homePortfolio, input.portfolioReturn, 1);
    ipPortfolio = grow(ipPortfolio, input.portfolioReturn, 1);
    // Use the home budget first. Add the same cash to both scenarios if rentvesting savings run out.
    const ipShortfall = Math.max(0, rentvestCash - homeCash - ipPortfolio);
    const matchedCash = homeCash + ipShortfall;
    const homePortfolioFlow = ipShortfall;
    const ipPortfolioFlow = matchedCash - rentvestCash;
    homePortfolio += homePortfolioFlow;
    ipPortfolio = Math.max(0, ipPortfolio + ipPortfolioFlow);

    const homeValue = grow(input.homePrice, input.homeGrowth, year);
    const ipValue = grow(input.ipPrice, input.ipGrowth, year);
    const homeSellingCosts = homeValue * sellingRate;
    const ipSellingCosts = ipValue * sellingRate;
    const ipCostBase = input.ipPrice + input.ipCosts - cumulativeDiv43;
    const ipGain = ipValue - ipSellingCosts - ipCostBase;
    // The first snapshot is the exact anniversary. Later snapshots qualify in this elected regime.
    const ipCgt = Math.max(0, ipGain) * (year === 1 ? 1 : 0.5) * taxRate;
    const homeEquity = homeValue - homeSellingCosts - home.balance;
    const ipEquity = ipValue - ipSellingCosts - ip.balance;
    const homeWealth = homeEquity + homePortfolio;
    const rentvestWealth = ipEquity + ipPortfolio - ipCgt;

    rows.push({
      year, homeValue, ipValue, homeSellingCosts, ipSellingCosts, homeEquity, ipEquity,
      homeLoan: home.balance, ipLoan: ip.balance, homeMortgage: home.repayments,
      ipMortgage: ip.repayments, ipInterest: ip.interest, rentPaid, rentReceived,
      operatingExpenses, netRentalIncome, div43, rentalTaxable, rentalTax, refund,
      cumulativeRefunds, cumulativeDiv43, homeCash, rentvestCash, matchedCash, homePortfolioFlow,
      ipPortfolioFlow, homePortfolio, ipPortfolio, homeCgt: 0, ipCostBase, ipGain, ipCgt,
      homeWealth, rentvestWealth, gap: rentvestWealth - homeWealth
    });
  }
  return { initial, rows, final: rows.at(-1) };
}
