export const LIMITS = Object.freeze({
  contribution: 50000, cesg: 7200, clb: 2000, basicAnnual: 500, basicWithCarry: 1000,
  additionalBase: 500, lowIncome: 58523, middleIncome: 117045, monthlyPenaltyRate: .01,
});

// ESDC notice #1138. Published thresholds are indexed individually.
const clbThresholds = [
  58523, 58523, 58523, 66036, 73577, 81117, 88658, 96198,
  103739, 111279, 118820, 126360, 133901, 141442, 148982, 156523,
];

export function additionalRate(income) {
  if (income <= LIMITS.lowIncome) return .2;
  return income <= LIMITS.middleIncome ? .1 : 0;
}

export function clbIncomeEligible(income, children) {
  const threshold = clbThresholds[children - 1];
  if (threshold === undefined) return null;
  return children <= 3 ? income <= threshold : income < threshold;
}

const cents = amount => Math.round(amount * 100);
const dollars = amount => amount / 100;

function validate(value, min, max, message, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(message);
  }
}

function grants(contribution, basicRoom, extraRate, lifetimeRoom) {
  const basic = Math.min(Math.round(contribution * .2), basicRoom, lifetimeRoom);
  const additional = Math.min(
    Math.round(Math.min(contribution, cents(LIMITS.additionalBase)) * extraRate),
    lifetimeRoom - basic,
  );
  return { basic, additional };
}

function grantDeposit(capacity, basicRoom, extraRate, lifetimeRoom) {
  const match = amount => {
    const { basic, additional } = grants(amount, basicRoom, extraRate, lifetimeRoom);
    return basic + additional;
  };
  // Avoid a deposit above the amount needed for the last partial lifetime grant.
  if (match(capacity) < lifetimeRoom) return capacity;
  let low = 0;
  let high = capacity;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (match(mid) < lifetimeRoom) low = mid + 1;
    else high = mid;
  }
  // Prefer a whole-dollar deposit where the cap can be reached within the budget.
  return Math.min(capacity, Math.ceil(low / 100) * 100);
}

function project(input, strategy) {
  const years = [];
  let contributed = input.priorContributions;
  let retained = input.priorRetained;
  let qualifyingYears = input.priorQualifyingYears;
  let carry = input.basicCarry;
  let cesgRoom = cents(LIMITS.cesg) - input.priorCesg;
  let clbRoom = cents(LIMITS.clb) - input.priorClb;
  let balance = input.openingBalance;
  let basicTotal = 0;
  let additionalTotal = 0;
  let clbTotal = 0;
  let refused = 0;
  for (let age = input.age; age < 18; age += 1) {
    const year = age - input.age;
    const qualifiesLate = retained >= cents(2000) || qualifyingYears >= 4;
    const eligible = age <= 15 || qualifiesLate;
    carry += cents(LIMITS.basicAnnual);
    const basicRoom = eligible ? Math.min(carry, cents(LIMITS.basicWithCarry)) : 0;
    const extraRate = eligible ? input.extraRate : 0;
    const room = Math.max(0, cents(LIMITS.contribution) - contributed);
    const requested = strategy({ year, age, room, basicRoom, extraRate, cesgRoom, qualifiesLate, retained });
    const contribution = Math.min(requested, room);
    refused += requested - contribution;

    const { basic, additional } = grants(contribution, basicRoom, extraRate, cesgRoom);
    carry -= basic;
    cesgRoom -= basic + additional;
    basicTotal += basic;
    additionalTotal += additional;

    const arrears = year === 0 ? input.unclaimedClb : 0;
    const firstClb = input.priorClb + clbTotal + arrears === 0;
    const clb = Math.min(clbRoom, arrears + (input.clbEligible && age <= 15 ? cents(firstClb ? 500 : 100) : 0));
    clbRoom -= clb;
    clbTotal += clb;
    contributed += contribution;

    if (age <= 15) {
      retained += contribution;
      if (contribution >= cents(100)) qualifyingYears += 1;
    }
    balance = (balance + contribution + basic + additional + clb) * (1 + input.annualReturn / 100);
    years.push({
      age, contribution: dollars(contribution), basic: dollars(basic), additional: dollars(additional),
      clb: dollars(clb), balance: dollars(Math.round(balance)), basicCarry: dollars(carry),
    });
  }
  const excess = Math.max(0, input.priorContributions - cents(LIMITS.contribution)) + refused;
  return {
    years, contributions: dollars(contributed - input.priorContributions), lifetimeContributions: dollars(contributed),
    basic: dollars(basicTotal), additional: dollars(additionalTotal), clb: dollars(clbTotal),
    grants: dollars(basicTotal + additionalTotal + clbTotal), balance: dollars(Math.round(balance)),
    excess: dollars(excess), refused: dollars(refused), monthlyPenalty: dollars(Math.round(excess * LIMITS.monthlyPenaltyRate)),
  };
}

export function comparePlans({
  age, priorContributions, priorCesg, income, children, annualContribution, annualReturn,
  basicCarry = 0, priorQualifyingYears = 0, priorRetained,
  priorClb = 0, unclaimedClb = 0, openingBalance = priorContributions + priorCesg + priorClb,
}) {
  validate(age, 0, 17, 'Enter the age your child turns in 2026, from 0 to 17.', true);
  validate(priorContributions, 0, 10000000, 'Enter prior contributions from $0 to $10,000,000.');
  validate(priorCesg, 0, LIMITS.cesg, 'Enter prior CESG from $0 to $7,200.');
  validate(income, 0, 1000000000, 'Enter adjusted family net income from $0 to $1,000,000,000.');
  validate(children, 1, 1000, 'Enter a whole number of children from 1 to 1,000.', true);
  validate(annualContribution, 0, 10000000, 'Enter annual contributions from $0 to $10,000,000.');
  validate(annualReturn, -100, 100, 'Enter an annual return from −100% to 100%.');
  validate(basicCarry, 0, age * LIMITS.basicAnnual, 'Prior Basic CESG room cannot exceed $500 per earlier calendar year.');
  const retained = priorRetained ?? (age < 17 ? priorContributions : 0);
  validate(retained, 0, priorContributions, 'Retained contributions cannot exceed prior contributions.');
  const qualifyingTotal = priorRetained ?? priorContributions;
  validate(priorQualifyingYears, 0, Math.min(age, 16, Math.floor(qualifyingTotal / 100)),
    'Qualifying years require at least $100 retained in each prior year, through age 15.', true);
  validate(priorClb, 0, LIMITS.clb, 'Enter prior Canada Learning Bond payments from $0 to $2,000.');
  validate(unclaimedClb, 0, LIMITS.clb - priorClb, 'Total paid and unclaimed Canada Learning Bond cannot exceed $2,000.');
  validate(openingBalance, 0, 11000000, 'Enter an opening balance from $0 to $11,000,000.');

  const extraRate = additionalRate(income);
  const clbEligible = clbIncomeEligible(income, children);
  const input = {
    age, extraRate, clbEligible, annualReturn, priorQualifyingYears,
    priorContributions: cents(priorContributions), priorRetained: cents(retained),
    priorCesg: cents(priorCesg), basicCarry: cents(basicCarry), priorClb: cents(priorClb),
    unclaimedClb: cents(unclaimedClb), openingBalance: cents(openingBalance),
  };
  const grantPlan = spread => ({ age: yearAge, room, basicRoom, extraRate, cesgRoom, qualifiesLate, retained }) => {
    if (!cesgRoom || !basicRoom) return 0;
    const matchable = Math.round(basicRoom / .2);
    let available = room;
    if (spread && extraRate) {
      const canQualify = yearAge <= 15 && room >= cents(2000) - retained;
      const lastAge = qualifiesLate || canQualify ? 17 : 15;
      const reserve = cents(LIMITS.additionalBase) * (lastAge - yearAge);
      const qualifyingDeposit = canQualify ? cents(2000) - retained : 0;
      available = Math.min(room, Math.max(room - reserve, cents(LIMITS.additionalBase), qualifyingDeposit));
    }
    return grantDeposit(Math.min(matchable, available), basicRoom, extraRate, cesgRoom);
  };
  const current = project(input, () => cents(annualContribution));
  const standard = project(input, grantPlan(false));
  const spread = extraRate ? project(input, grantPlan(true)) : standard;
  const grant = spread.grants > standard.grants ? spread : standard;
  const hybrid = project(input, ({ year, room }) => {
    const scheduled = year === 0 ? 16500 : year < 14 ? 2500 : year === 14 ? 1000 : 0;
    return Math.min(cents(scheduled), room);
  });
  const lump = project(input, ({ year, room }) => year === 0 ? room : 0);
  const plans = { current, grant, hybrid, lump };
  for (const plan of Object.values(plans)) plan.extraVsCurrent = dollars(cents(plan.balance) - cents(current.balance));

  return {
    plans, extraRate, clbEligible, openingBalance: dollars(input.openingBalance),
    remainingContribution: Math.max(0, LIMITS.contribution - dollars(input.priorContributions)),
    existingExcess: Math.max(0, dollars(input.priorContributions) - LIMITS.contribution),
    hybridVsLump: dollars(cents(hybrid.balance) - cents(lump.balance)),
  };
}
