const MAX_CENTS = 100_000_000_000;
const BPS = 10_000;
const rateOf = (amount, rate) => Math.floor((amount * rate + BPS / 2) / BPS);

export function parseCents(value) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (match) {
    const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
    if (amount <= MAX_CENTS) return amount;
  }
  throw new RangeError('Enter an amount from 0 to 1 billion with up to two decimal places and no commas.');
}

function checkAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS) {
    throw new RangeError('Money inputs must be whole cents within the supported range.');
  }
}

export const CURRENT_CAP = 3_250_000;
export const SG_BASE = 27_083_000;
const BALANCE_LIMIT = 50_000_000;
const DIV_THRESHOLD = 25_000_000;
export const HISTORY = Object.freeze([
  Object.freeze({year: '2021–22', cap: 2_750_000}),
  Object.freeze({year: '2022–23', cap: 2_750_000}),
  Object.freeze({year: '2023–24', cap: 2_750_000}),
  Object.freeze({year: '2024–25', cap: 3_000_000}),
  Object.freeze({year: '2025–26', cap: 3_000_000}),
]);

function taxReduction(income, deduction, medicare) {
  const taxable = income + deduction;
  const bands = [[1_820_000, 0], [4_500_000, 1500], [13_500_000, 3000],
    [19_000_000, 3700], [taxable, 4500]];
  let floor = 0;
  let taxUnits = 0;
  for (const [ceiling, rate] of bands) {
    const slice = Math.max(0, Math.min(taxable, ceiling) - Math.max(income, floor));
    taxUnits += slice * rate;
    floor = ceiling;
  }
  return Math.floor((taxUnits + (medicare ? deduction * 200 : 0) + BPS / 2) / BPS);
}

function division293(income, contributions) {
  return rateOf(Math.min(contributions, Math.max(0, income + contributions - DIV_THRESHOLD)), 1500);
}

export function calculateSuper({earnings, otherEmployer, voluntary, taxableIncome, divIncome, balance, unused, medicare}) {
  for (const amount of [earnings, otherEmployer, voluntary, taxableIncome, divIncome, balance]) checkAmount(amount);
  if (!Array.isArray(unused) || unused.length !== HISTORY.length) throw new RangeError('Enter all five unused cap balances.');
  for (const [index, {year, cap}] of HISTORY.entries()) {
    checkAmount(unused[index]);
    if (unused[index] > cap) throw new RangeError('Unused ' + year + ' room exceeds that year’s general cap.');
  }

  const eligible = balance < BALANCE_LIMIT;
  const carryAvailable = eligible ? unused.reduce((total, amount) => total + amount, 0) : 0;
  const available = CURRENT_CAP + carryAvailable;
  const sg = rateOf(Math.min(earnings, SG_BASE), 1200);
  const employer = sg + otherEmployer;
  const contributions = employer + voluntary;
  const inCap = Math.min(available, contributions);
  const excess = contributions - inCap;
  let carryNeeded = Math.max(0, inCap - CURRENT_CAP);
  const carryUsed = unused.map(room => {
    const used = Math.min(room, carryNeeded);
    carryNeeded -= used;
    return used;
  });
  const carryRemaining = carryAvailable - carryUsed.reduce((total, amount) => total + amount, 0);
  const savingEligible = Math.max(0, inCap - employer);
  const taxSaved = taxReduction(taxableIncome, savingEligible, medicare);
  const fundTax = rateOf(inCap, 1500);
  const voluntaryFundTax = fundTax - rateOf(Math.min(inCap, employer), 1500);
  const divTax = division293(divIncome, inCap);
  const incrementalDivTax = divTax - division293(divIncome + savingEligible, Math.min(inCap, employer));

  return {
    currentCap: CURRENT_CAP, eligible, sg, employer, carryAvailable, available, contributions, inCap, excess,
    room: available - inCap, carryUsed, carryRemaining, oldestRemaining: unused[0] - carryUsed[0], savingEligible,
    taxReduction: taxSaved, fundTax, voluntaryFundTax, divTax, incrementalDivTax,
    netSaving: taxSaved - voluntaryFundTax - incrementalDivTax,
  };
}
