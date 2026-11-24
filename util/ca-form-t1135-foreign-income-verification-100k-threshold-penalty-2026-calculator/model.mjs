export const FIRST_YEAR = 2015;
export const LAST_YEAR = 2026;

const FILING_THRESHOLD = 10_000_000;
const DETAILED_THRESHOLD = 25_000_000;
const INCLUDED = ['stocks', 'bank', 'rent', 'other'];
const EXCLUDED = ['registered', 'canadianFunds', 'personalUse'];
const SCENARIOS = ['standard', 'gross', 'grossDemand', 'demandOnly'];
const DAY_MS = 86_400_000;

export function cadToCents(value) {
  const input = String(value).trim();
  if (input === '') return 0;
  if (!/^(?:[0-9]{1,10}(?:\.[0-9]{0,2})?|\.[0-9]{1,2})$/.test(input)) {
    throw new RangeError('Enter a CAD amount from 0 to 1,000,000,000 with up to two decimal places and no commas.');
  }
  const [whole, fraction = ''] = input.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > 100_000_000_000) {
    throw new RangeError('Enter a CAD amount no greater than 1,000,000,000.');
  }
  return cents;
}

export function filingTier(costCents) {
  if (costCents <= FILING_THRESHOLD) return 'EXEMPT';
  if (costCents < DETAILED_THRESHOLD) return 'PART A';
  return 'PART B';
}

export function calculateHoldings(snapshots) {
  let peak = 0;
  let excludedPeak = 0;
  let jointPeak = 0;
  for (const snapshot of snapshots) {
    const jointShare = (snapshot.joint ?? 0) / 2;
    const qualifying = INCLUDED.reduce((total, key) => total + (snapshot[key] ?? 0), jointShare);
    const excluded = EXCLUDED.reduce((total, key) => total + (snapshot[key] ?? 0), 0);
    peak = Math.max(peak, qualifying);
    excludedPeak = Math.max(excludedPeak, excluded);
    jointPeak = Math.max(jointPeak, jointShare);
  }
  return { peak, excludedPeak, jointPeak, tier: filingTier(peak), jointTier: filingTier(jointPeak) };
}

function readDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Enter a complete date.');
  }
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError('Enter a valid calendar date.');
  }
  return date;
}

function countMonths(start, end) {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth() + 1;
}

export function calculatePenalty({ peak, due, end, scenario, demand }) {
  if (!SCENARIOS.includes(scenario)) throw new RangeError('Choose a valid penalty scenario.');
  const dueDate = readDate(due);
  const endDate = readDate(end);
  const days = Math.max(0, (endDate - dueDate) / DAY_MS);
  const zero = { days, months: 0, standard: 0, enhanced: 0, additional: 0, total: 0 };
  if (days === 0 || filingTier(peak) === 'EXEMPT') return zero;

  const standard = Math.max(10_000, Math.min(days, 100) * 2_500);
  if (scenario === 'standard') return { ...zero, standard, total: standard };

  let start = dueDate;
  if (scenario === 'demandOnly') {
    start = readDate(demand);
    if (start <= dueDate || start >= endDate) {
      throw new RangeError('The demand date must be after the filing due date and before the end date.');
    }
  }
  const months = countMonths(start, endDate);
  const monthlyRate = scenario === 'gross' ? 50_000 : 100_000;
  const enhanced = Math.max(0, Math.min(months, 24) * monthlyRate - standard);
  const additional = months > 24 ? Math.max(0, Math.round(peak / 20) - standard - enhanced) : 0;
  return { days, months, standard, enhanced, additional, total: standard + enhanced + additional };
}

export function calculateYears(entries) {
  const seen = new Set();
  let total = 0;
  const results = entries.map(({ year, snapshots, ...timing }) => {
    if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR) {
      throw new RangeError('Enter a tax year from 2015 to 2026.');
    }
    if (seen.has(year)) throw new RangeError('Enter each tax year only once.');
    seen.add(year);
    if (readDate(timing.due).getUTCFullYear() <= year) {
      throw new RangeError('For this calendar-year model, enter a due date after the selected tax year.');
    }
    const holdings = calculateHoldings(snapshots);
    const penalty = calculatePenalty({ ...timing, peak: holdings.peak });
    total += penalty.total;
    return { year, ...holdings, penalty };
  });
  return { results, total };
}
