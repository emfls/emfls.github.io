export const DCFSA_LIMIT = 7500;
const JOINT = 'mfj';
const SUPPORTED_STATUSES = ['single', 'hoh', JOINT];

function amountInCents(value, label, minimum = 0, maximum = Infinity) {
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return cents;
}

function dollars(cents) {
  return Math.round(cents) / 100;
}

function rateBands(status) {
  return {
    upperStart: status === JOINT ? 150000 : 75000,
    upperStep: status === JOINT ? 4000 : 2000,
  };
}

function lowerSteps(agi) {
  return Math.min(15, Math.max(0, Math.ceil((agi - 15000) / 2000)));
}

// Rates are returned in whole percentage points.
export function creditRate(status, agi) {
  if (status === 'mfs') return 0;
  if (!SUPPORTED_STATUSES.includes(status) || !Number.isFinite(agi)) {
    throw new RangeError('Enter a supported filing status and valid AGI.');
  }
  const { upperStart, upperStep } = rateBands(status);
  const upperSteps = Math.max(0, Math.ceil((agi - upperStart) / upperStep));
  return Math.max(20, 50 - lowerSteps(agi) - upperSteps);
}

export function pre2026CreditRate(agi) {
  if (!Number.isFinite(agi)) throw new RangeError('Enter a valid AGI.');
  return 35 - lowerSteps(agi);
}

function findOptimal(scenarioAt, maxElection, baseAgi, expenseLimit, earned, taxLimit, status) {
  const candidates = new Set();
  function addAround(cents) {
    for (const candidate of [Math.floor(cents), Math.ceil(cents)]) {
      if (candidate >= 0 && candidate <= maxElection) candidates.add(candidate);
    }
  }

  // Within a rate band, savings are linear between credit-base and liability breakpoints.
  addAround(0);
  addAround(maxElection);
  addAround(expenseLimit - earned);
  addAround(expenseLimit);
  if (taxLimit !== Infinity) {
    for (let rate = 20; rate <= 50; rate++) {
      addAround(expenseLimit - (taxLimit * 100) / rate);
    }
  }

  // A larger exclusion can bring AGI into a higher-rate band. Check both sides.
  const { upperStart, upperStep } = rateBands(status);
  for (let step = 0; step < 15; step++) {
    for (const threshold of [15000 + 2000 * step, upperStart + upperStep * step]) {
      const firstCentInBand = baseAgi - threshold * 100;
      addAround(firstCentInBand);
      addAround(firstCentInBand - 1);
    }
  }

  let best = scenarioAt(0);
  for (const election of candidates) {
    const candidate = scenarioAt(election);
    if (
      candidate.score > best.score ||
      (candidate.score === best.score && election < best.election)
    ) best = candidate;
  }
  return best;
}

export function calculate({
  status, qualifyingPersons, agi, earnedIncome, careCosts, election, marginalRate,
  planLimit = DCFSA_LIMIT, taxLimit = null,
}) {
  if (!SUPPORTED_STATUSES.includes(status)) throw new RangeError('Choose a supported filing status.');
  if (!Number.isSafeInteger(qualifyingPersons) || qualifyingPersons < 1) {
    throw new RangeError('Choose one or more qualifying persons.');
  }

  const agiCents = amountInCents(agi, 'adjusted gross income', -Infinity);
  const earned = amountInCents(earnedIncome, 'earned income');
  const costs = amountInCents(careCosts, 'qualified care cost');
  const elected = amountInCents(election, 'DCFSA election from $0 to $7,500', 0, DCFSA_LIMIT);
  const employerLimit = amountInCents(planLimit, 'employer limit from $0 to $7,500', 0, DCFSA_LIMIT);
  const taxRate = amountInCents(marginalRate, 'marginal tax rate from 0% to 100%', 0, 100);
  const liability = taxLimit === null ? Infinity : amountInCents(taxLimit, 'tax liability limit');
  const expenseCap = qualifyingPersons === 1 ? 300000 : 600000;
  const expenseLimit = Math.min(costs, expenseCap);
  const maxElection = Math.min(employerLimit, costs, earned);
  // The entered AGI is the projection after the current exclusion.
  const baseAgi = agiCents + Math.min(elected, maxElection);

  function scenarioAt(electionCents) {
    const excluded = Math.min(electionCents, maxElection);
    const scenarioAgi = (baseAgi - excluded) / 100;
    const rate = creditRate(status, scenarioAgi);
    const expenses = Math.min(earned, Math.max(0, expenseLimit - excluded));
    // Score in 1/10,000ths of a cent to compare unrounded savings.
    const credit = Math.min(expenses * rate * 100, liability * 10000);
    const fsaSavings = excluded * taxRate;
    return {
      election: electionCents, excluded, agi: scenarioAgi, rate, expenses,
      credit, fsaSavings, score: credit + fsaSavings,
    };
  }

  const current = scenarioAt(elected);
  const priorRate = pre2026CreditRate(current.agi);
  const priorCredit = Math.min(current.expenses * priorRate * 100, liability * 10000);
  const optimal = findOptimal(scenarioAt, maxElection, baseAgi, expenseLimit, earned, liability, status);
  return {
    rate: current.rate,
    expenseCap: dollars(expenseCap),
    excludedBenefits: dollars(current.excluded),
    unexcludedElection: dollars(elected - current.excluded),
    creditExpenses: dollars(current.expenses),
    credit: dollars(current.credit / 10000),
    pre2026Rate: priorRate,
    pre2026Credit: dollars(priorCredit / 10000),
    creditGain: dollars((current.credit - priorCredit) / 10000),
    fsaSavings: dollars(current.fsaSavings / 10000),
    combinedSavings: dollars(current.score / 10000),
    optimal: {
      election: dollars(optimal.election),
      agi: optimal.agi,
      rate: optimal.rate,
      credit: dollars(optimal.credit / 10000),
      fsaSavings: dollars(optimal.fsaSavings / 10000),
      combinedSavings: dollars(optimal.score / 10000),
      additionalSavings: dollars((optimal.score - current.score) / 10000),
    },
  };
}
