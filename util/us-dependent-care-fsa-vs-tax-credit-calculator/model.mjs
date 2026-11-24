const MAX_CENTS = 100_000_000_000;
const BPS = 10_000;
const roundBps = scaled => Math.floor((scaled + BPS / 2) / BPS);

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
    throw new RangeError('Enter a nonnegative amount within the supported range.');
  }
}

export const SOCIAL_SECURITY_BASE = 18_450_000;
const STATUSES = ['single', 'hoh', 'joint', 'separate'];

export function creditRate(agi, status) {
  if (!Number.isSafeInteger(agi) || !STATUSES.includes(status)) {
    throw new RangeError('Enter an AGI in cents and select a filing status.');
  }
  if (status === 'separate') return 0;
  const joint = status === 'joint';
  const first = Math.ceil(Math.max(0, agi - 1_500_000) / 200_000);
  const second = Math.ceil(Math.max(0, agi - (joint ? 15_000_000 : 7_500_000)) /
    (joint ? 400_000 : 200_000));
  return Math.max(20, Math.max(35, 50 - first) - second);
}

export function compareCare(input) {
  const {status, people, agi, expenses, wages, spouse, planLimit, federal, state, liability} = input;
  [agi, expenses, wages, spouse, planLimit, liability].forEach(checkAmount);
  if (![1, 2].includes(people)) throw new RangeError('Select one or two or more qualifying people.');
  if (![federal, state].every(rate => Number.isInteger(rate) && rate >= 0 && rate <= BPS)) {
    throw new RangeError('Enter tax rates from 0% to 100%.');
  }
  const married = status === 'joint' || status === 'separate';
  const statutoryLimit = status === 'separate' ? 375_000 : 750_000;
  const expenseCap = people === 1 ? 300_000 : 600_000;
  const earnedLimit = married ? spouse : wages;
  // Form 2441 excludes the elected benefit from the employee earned-income ceiling.
  const maxElection = Math.min(statutoryLimit, planLimit, expenses, Math.floor(wages / 2), earnedLimit);
  const creditCeiling = Math.min(expenseCap, expenses, wages);
  const startingSSWages = Math.min(wages, SOCIAL_SECURITY_BASE);
  const stateFederalMedicare = federal + state + 145;

  const socialSecurityScaled = election =>
    (startingSSWages - Math.min(wages - election, SOCIAL_SECURITY_BASE)) * 620;
  const savingsScaled = election => election * stateFederalMedicare + socialSecurityScaled(election);
  const creditBase = election => Math.max(0, Math.min(creditCeiling - election, earnedLimit));
  const creditScaled = (election, rate) => Math.min(liability * BPS, creditBase(election) * rate * 100);

  function scenario(election) {
    const rate = creditRate(agi - election, status);
    const savings = savingsScaled(election);
    const credit = creditScaled(election, rate);
    return {
      election, agi: agi - election, rate, creditBase: rate > 0 ? creditBase(election) : 0,
      credit: roundBps(credit), savings: roundBps(savings), total: roundBps(savings + credit),
      socialSecurity: roundBps(socialSecurityScaled(election)), medicare: roundBps(election * 145),
    };
  }

  const credit = scenario(0);
  const full = scenario(maxElection);
  // Each cent through the statutory cap is feasible. Compare before rounding and prefer
  // the smaller election on ties. This also captures discontinuous AGI rate changes.
  let bestElection = 0;
  let bestValue = creditScaled(0, credit.rate);
  for (let election = 1; election <= maxElection; election++) {
    const rate = creditRate(agi - election, status);
    const value = savingsScaled(election) + creditScaled(election, rate);
    if (value > bestValue) {
      bestValue = value;
      bestElection = election;
    }
  }
  return {statutoryLimit, expenseCap, credit, full, best: scenario(bestElection)};
}
