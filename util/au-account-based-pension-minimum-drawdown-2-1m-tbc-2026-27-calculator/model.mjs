const YEAR_START = Date.UTC(2026, 6, 1);
const YEAR_END = Date.UTC(2027, 6, 1);
const JUNE_START = Date.UTC(2027, 5, 1);
const DAY_MS = 86_400_000;
const YEAR_DAYS = (YEAR_END - YEAR_START) / DAY_MS;
const GENERAL_CAP = 2_100_000;
const INDEX_INCREASE = 100_000;
const TTR = 'ttr_max_10pct';

function numberInRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function validAge(age) {
  numberInRange(age, 0, 150, 'Age');
  if (!Number.isInteger(age)) throw new RangeError('Age must be a whole number.');
  return age;
}

const cents = value => Math.round(value * 100);
const dollars = value => cents(value) / 100;

export function minimumRate(age) {
  validAge(age);
  const bracket = [[65, 4], [75, 5], [80, 6], [85, 7], [90, 9], [95, 11]]
    .find(([upperAge]) => age < upperAge);
  return bracket ? bracket[1] : 14;
}

export function paymentLimits({ age, balance, type = 'account_based', startDate = '', startAge = age }) {
  validAge(age);
  numberInRange(balance, 0, Number.MAX_SAFE_INTEGER / 10000, 'Pension balance');
  if (type !== 'account_based' && type !== TTR) throw new RangeError('Select a pension type.');

  let paymentAge = age;
  let start = YEAR_START;
  if (startDate) {
    start = Date.parse(`${startDate}T00:00:00Z`);
    if (!Number.isFinite(start) || start < YEAR_START || start >= YEAR_END ||
        new Date(start).toISOString().slice(0, 10) !== startDate) {
      throw new RangeError('Enter a commencement date in 2026–27.');
    }
    validAge(startAge);
    if (startAge < age || startAge > age + 1 || (start === YEAR_START && startAge !== age)) {
      throw new RangeError('Check the age at commencement against the age on 1 July.');
    }
    paymentAge = startAge;
  }

  if (type === TTR && (paymentAge < 60 || paymentAge >= 65)) {
    throw new RangeError('TTR age on the assessment date must be 60–64.');
  }

  const days = (YEAR_END - start) / DAY_MS;
  const fraction = days / YEAR_DAYS;
  const rate = minimumRate(paymentAge);
  const balanceCents = cents(balance);
  // Work in cents and whole days so exact $5 ties round upwards.
  const minimum = start >= JUNE_START ? 0
    : 10 * Math.round(balanceCents * rate * days / (100_000 * YEAR_DAYS));
  const maximum = type === TTR ? Math.floor(balanceCents / 10) / 100 : null;
  return { rate, minimum, monthly: minimum / 12, maximum, fraction };
}

export function personalCap({ priorCap = null, highestTba, peakCap, currentTba, previouslyReachedCap = false }) {
  numberInRange(currentTba, -100_000_000, 100_000_000, 'Current transfer balance');
  let cap = GENERAL_CAP;
  let unusedPercent = null;
  let increase = null;
  if (priorCap !== null) {
    numberInRange(priorCap, 1_600_000, 2_000_000, 'Previous personal cap');
    numberInRange(peakCap, 1_600_000, priorCap, 'Personal cap at the peak');
    numberInRange(highestTba, -100_000_000, 100_000_000, 'Historic peak transfer balance');
    // Section 294-40 rounds the used percentage down before subtracting from 100.
    const used = Math.floor(100 * cents(highestTba) / cents(peakCap));
    unusedPercent = previouslyReachedCap ? 0 : 100 - Math.min(100, Math.max(0, used));
    increase = unusedPercent * (INDEX_INCREASE / 100);
    cap = dollars(priorCap + increase);
  }
  const remaining = dollars(cap - currentTba);
  return { cap, space: Math.max(0, remaining), excess: Math.max(0, -remaining), unusedPercent, increase };
}

export function projectPension({
  age, balance, type = 'account_based', startDate = '', startAge,
  target = null, netReturn, inflation
}) {
  numberInRange(age, 0, 125, 'Age');
  numberInRange(balance, 0, 100_000_000, 'Pension balance');
  numberInRange(netReturn, -100, 30, 'Net return');
  numberInRange(inflation, -10, 20, 'Inflation');
  if (target !== null) numberInRange(target, 0, 100_000_000, 'Annual target');

  const firstLimits = paymentLimits({ age, balance, type, startDate, startAge });
  const growth = 1 + netReturn / 100;
  const inflationFactor = 1 + inflation / 100;
  let opening = dollars(balance);
  const rows = [];
  for (let year = 0; year < 25; year += 1) {
    const julyAge = age + year;
    const assessmentAge = year === 0 && startDate ? startAge ?? age : julyAge;
    const stream = julyAge >= 65 ? 'account_based' : type;
    const limits = year === 0 ? firstLimits : paymentLimits({ age: julyAge, balance: opening, type: stream });
    const planned = target === null ? null : dollars(target * inflationFactor ** year * limits.fraction);
    const withdrawal = Math.min(opening, limits.maximum ?? opening, Math.max(limits.minimum, planned ?? 0));
    const closing = dollars((opening - withdrawal) * growth ** limits.fraction);
    rows.push({
      year: 2026 + year, age: assessmentAge, opening, ...limits, target: planned, withdrawal, closing,
      realClosing: dollars(closing / inflationFactor ** (year + 1)),
      stepUp: year > 0 && limits.rate > rows[year - 1].rate
    });
    opening = closing;
  }

  function balanceAtAge(milestone) {
    const years = milestone - age;
    if (years < 0 || years > rows.length || (years === 0 && startDate && firstLimits.fraction < 1)) return null;
    return years === 0 ? dollars(balance) : rows[years - 1].closing;
  }
  return { rows, age85: balanceAtAge(85), age95: balanceAtAge(95) };
}
