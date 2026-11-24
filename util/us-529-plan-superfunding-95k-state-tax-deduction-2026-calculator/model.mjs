export const ANNUAL_EXCLUSION = 19000;
export const ELECTION_YEARS = 5;
export const K12_LIMIT = 20000;

export const STATE_RULES = Object.freeze({
  NY: Object.freeze({ caps: Object.freeze([5000, 10000]), rate: 6 }),
  IL: Object.freeze({ caps: Object.freeze([10000, 20000]), rate: 4.95 }),
  PA: Object.freeze({ caps: Object.freeze([19000, 38000]), rate: 3.07, parity: true }),
  IN: Object.freeze({ caps: Object.freeze([1500, 1500, 750]), rate: 20, credit: true }),
  CO: Object.freeze({ caps: Object.freeze([26200, 39200]), rate: 4.40 }),
  VA: Object.freeze({ caps: Object.freeze([4000, 4000]), rate: 5.75, carry: Infinity }),
  OH: Object.freeze({ caps: Object.freeze([4000, 4000]), rate: 2.75, carry: Infinity, parity: true }),
  MI: Object.freeze({ caps: Object.freeze([5000, 10000]), rate: 4.25 }),
  MD: Object.freeze({ caps: Object.freeze([2500, 5000]), rate: 5.75, carry: 10 })
});

function number(value, min, max, label, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  }
  return value;
}

const cents = value => Math.round(value * 100);

export function statePolicy({ state, filing, inState, rate, liability, customKind, customCap, customCarry }) {
  const filingIndex = ['single', 'joint', 'separate'].indexOf(filing);
  if (filingIndex < 0) throw new RangeError('Choose a state filing status.');
  const rule = Object.hasOwn(STATE_RULES, state) ? STATE_RULES[state] : null;
  if (!rule && state !== 'CUSTOM') throw new RangeError('Choose a state.');
  const credit = rule ? Boolean(rule.credit) : customKind === 'credit';
  if (!rule && !['credit', 'deduction'].includes(customKind)) throw new RangeError('Choose a custom benefit type.');
  const cap = rule ? (rule.caps[filingIndex] ?? rule.caps[0]) : number(customCap, 0, 10000000, 'Custom annual cap');
  const percent = rule?.credit ? rule.rate : number(rate, 0, 100, 'State deduction or credit rate');
  return {
    cap, credit, rate: percent / 100,
    carry: rule ? (rule.carry ?? 0) : number(customCarry, 0, 30, 'Custom carryforward', true),
    eligible: Boolean(rule?.parity || inState),
    liability: credit ? number(liability, 0, 10000000, 'Available state tax liability') : Infinity
  };
}

function stateSavings(schedule, { cap, credit, rate, carry, eligible, liability }) {
  const maxBenefit = credit ? Math.min(cap, liability) : cap * rate;
  if (!eligible || !rate || !maxBenefit) return { first: 0, later: 0, total: 0 };
  const queue = [];
  const capacity = credit ? maxBenefit / rate : cap;
  let first = 0;
  let later = 0;

  // Each contribution expires independently. Use oldest eligible dollars first.
  const years = schedule.length + (Number.isFinite(carry) ? carry : 0);
  for (let year = 0; year < years; year++) {
    while (queue.length && queue[0].expires < year) queue.shift();
    if (schedule[year] > 0) queue.push({ amount: schedule[year], expires: year + carry });
    let available = capacity;
    while (queue.length && available > 0) {
      const entry = queue[0];
      const used = Math.min(available, entry.amount);
      available -= used;
      entry.amount -= used;
      if (year === 0) first += used * rate;
      else later += used * rate;
      if (entry.amount === 0) queue.shift();
    }
  }

  // Uncapped carryforward time can extend beyond the final deposit by decades.
  if (carry === Infinity) later += queue.reduce((sum, entry) => sum + entry.amount, 0) * rate;
  return { first, later, total: first + later };
}

function giftProjection(schedule, donors, split, elect, otherFirst, otherLater) {
  const annualLimit = ANNUAL_EXCLUSION * donors;
  const election = elect && schedule[0] > annualLimit
    ? Math.min(schedule[0], annualLimit * ELECTION_YEARS) : 0;
  const years = Math.max(schedule.length, election ? ELECTION_YEARS : 1);
  const rows = Array.from({ length: years }, (_, year) => {
    const allocated = (year < ELECTION_YEARS ? election / ELECTION_YEARS : 0)
      + (schedule[year] ?? 0) - (year === 0 ? election : 0);
    const other = (year === 0 ? otherFirst : otherLater) * donors;
    const excess = Math.max(0, allocated + other - annualLimit);
    return { year: 2026 + year, allocated, other, remaining: Math.max(0, annualLimit - allocated - other), excess };
  });

  return {
    annualLimit, election, rows, split,
    firstYearFiling: election > 0 || rows[0].excess > 0 || (split && rows[0].allocated + rows[0].other > 0),
    excess: rows.reduce((sum, row) => sum + row.excess, 0)
  };
}

export function k12Projection(expenses, planned, prior) {
  number(expenses, 0, 10000000, 'Eligible K–12 expenses');
  number(planned, 0, 10000000, 'Planned K–12 withdrawal');
  number(prior, 0, 10000000, 'Prior K–12 withdrawals');
  const remainingLimit = Math.max(0, K12_LIMIT - prior);
  const remainingExpenses = Math.max(0, expenses - prior);
  const qualified = Math.min(planned, remainingLimit, remainingExpenses);
  return { remainingLimit, remainingExpenses, qualified, excess: planned - qualified };
}

export function calculate(input) {
  const totalCents = cents(number(input.total, 0, 10000000, 'Total contribution'));
  const total = totalCents / 100;
  const horizon = 18 - number(input.age, 0, 13, 'Beneficiary age', true);
  const years = number(input.years, 5, horizon, 'Annual contribution years', true);
  const growth = 1 + number(input.returnRate, -100, 100, 'Annual investment return') / 100;
  const gainsRate = number(input.gainsRate, 0, 100, 'Federal capital gains rate') / 100;
  if (!['one', 'two', 'split'].includes(input.giftMode)) throw new RangeError('Choose a donor arrangement.');
  const donors = input.giftMode === 'one' ? 1 : 2;
  const split = input.giftMode === 'split';
  const otherFirst = cents(number(input.otherFirst, 0, 10000000, 'Other 2026 gifts per donor')) / 100;
  const otherLater = cents(number(input.otherLater, 0, 10000000, 'Other later gifts per donor')) / 100;
  const policy = statePolicy(input);
  const base = Math.floor(totalCents / years);
  const remainder = totalCents % years;
  const annual = Array.from({ length: years }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);

  function scenario(schedule, elect) {
    const balance = schedule.reduce((sum, contribution, year) => sum + contribution * growth ** (horizon - year), 0);
    const gainsTax = Math.max(0, balance - total) * gainsRate;
    return {
      balance, gainsTax, brokerageNet: balance - gainsTax,
      state: stateSavings(schedule, policy),
      gift: giftProjection(schedule, donors, split, elect, otherFirst, otherLater)
    };
  }

  const lump = scenario([total], true);
  const spread = scenario(annual, false);
  return {
    total, horizon, annual, lump, spread,
    extraWealth: lump.balance - spread.balance,
    stateDifference: lump.state.total - spread.state.total,
    policy, k12: k12Projection(input.expenses, input.planned, input.prior)
  };
}
