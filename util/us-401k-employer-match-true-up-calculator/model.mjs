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

export const BASE_LIMIT = 2_450_000;
export const COMPENSATION_LIMIT = 36_000_000;
const ADDITIONS_LIMIT = 7_200_000;

export function deferralLimit(age, catchUp) {
  if (!Number.isInteger(age) || age < 0 || age > 120) throw new RangeError('Enter a whole-number age from 0 to 120.');
  if (!catchUp || age < 50) return BASE_LIMIT;
  return BASE_LIMIT + (age >= 60 && age <= 63 ? 1_125_000 : 800_000);
}

function checkRate(rate, max) {
  if (!Number.isInteger(rate) || rate < 0 || rate > max) {
    throw new RangeError('Enter a percentage within the range shown, using up to two decimal places.');
  }
}

const roundDivide = (amount, divisor) => Math.floor((amount + Math.floor(divisor / 2)) / divisor);

export function calculateMatch({
  salary, age, catchUp, periods, contributionRate, matchRate, matchLimit, trueUp, compensationMethod,
}) {
  checkAmount(salary);
  checkRate(contributionRate, BPS);
  checkRate(matchRate, 10 * BPS);
  checkRate(matchLimit, BPS);
  if (![12, 24, 26, 52].includes(periods)) throw new RangeError('Choose a supported number of paychecks.');
  if (!['prorated', 'cumulative'].includes(compensationMethod)) throw new RangeError('Choose a compensation method.');

  const annualLimit = deferralLimit(age, catchUp);
  const eligiblePay = Math.min(salary, COMPENSATION_LIMIT);
  const steadyTotal = Math.min(eligiblePay, annualLimit);
  const fullMatchBase = rateOf(eligiblePay, matchLimit);
  const schedule = [];
  let capPaycheck = null;
  let deferred = 0;
  let steadyDeferred = 0;
  let matchedBase = 0;
  let steadyMatchedBase = 0;
  let previousEligible = 0;
  let previousGross = 0;
  for (let paycheck = 1; paycheck <= periods; paycheck += 1) {
    // Differences of cumulative amounts reconcile the last penny of each annual total.
    const grossToDate = roundDivide(salary * paycheck, periods);
    const eligibleToDate = compensationMethod === 'prorated'
      ? roundDivide(eligiblePay * paycheck, periods)
      : Math.min(grossToDate, eligiblePay);
    const eligible = eligibleToDate - previousEligible;
    const deferral = Math.min(annualLimit, rateOf(eligibleToDate, contributionRate)) - deferred;
    const steadyToDate = eligiblePay === 0 ? 0 : roundDivide(steadyTotal * eligibleToDate, eligiblePay);
    const steadyDeferral = steadyToDate - steadyDeferred;
    const matchable = rateOf(eligibleToDate, matchLimit) - rateOf(previousEligible, matchLimit);
    deferred += deferral;
    steadyDeferred = steadyToDate;
    matchedBase += Math.min(deferral, matchable);
    steadyMatchedBase += Math.min(steadyDeferral, matchable);
    if (capPaycheck === null && deferred === annualLimit) capPaycheck = paycheck;
    schedule.push({paycheck, gross: grossToDate - previousGross, eligible, deferral, steadyDeferral, matchedBase});
    previousGross = grossToDate;
    previousEligible = eligibleToDate;
  }

  const matchRoom = total => Math.max(0, Math.min(salary, ADDITIONS_LIMIT) - Math.min(total, BASE_LIMIT));
  const formulaMatch = (base, deferrals) => Math.min(rateOf(base, matchRate), matchRoom(deferrals));
  const annualMatch = formulaMatch(Math.min(deferred, fullMatchBase), deferred);
  const steadyMatch = formulaMatch(steadyMatchedBase, steadyTotal);
  const fullMatch = formulaMatch(fullMatchBase, steadyTotal);
  let matchReceived = 0;
  for (const row of schedule) {
    const matchToDate = formulaMatch(row.matchedBase, deferred);
    row.match = matchToDate - matchReceived;
    matchReceived = matchToDate;
    delete row.matchedBase;
  }

  const timingGap = annualMatch - matchReceived;
  const trueUpOwed = trueUp ? timingGap : 0;
  return {
    annualLimit, eligiblePay, capPaycheck, deferred, matchReceived, annualMatch, timingGap, trueUpOwed,
    matchLost: timingGap - trueUpOwed, totalMatch: matchReceived + trueUpOwed, schedule,
    steadyTotal, steadyMatch, fullMatch, steadyShortfall: fullMatch - steadyMatch,
    steadyAmount: roundDivide(steadyTotal, periods),
    steadyRate: eligiblePay === 0 ? 0 : roundDivide(steadyTotal * BPS, eligiblePay),
  };
}
