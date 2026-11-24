const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

export const limits = Object.freeze({
  monthlyWage: [1, 100_000_000],
  annualExtras: [0, 1_000_000_000],
  dailyOrdinaryWage: [0, 10_000_000],
  averageDays: [89, 92, true],
  pastDays: [0, 25_550, true],
  years: [1, 40, true],
  wageGrowth: [0, 0.5],
  peakYears: [0, 40, true],
  peakCut: [0, 0.99],
  dcReturn: [-1, 1],
});
for (const range of Object.values(limits)) Object.freeze(range);

export function averageDailyWage(monthlyWage, annualExtras, averageDays, dailyOrdinaryWage = 0) {
  const periodWage = monthlyWage * 3 + annualExtras * 3 / MONTHS_PER_YEAR;
  return Math.max(periodWage / averageDays, dailyOrdinaryWage);
}

export function dbBenefit(dailyWage, serviceDays) {
  return dailyWage * 30 * (serviceDays / DAYS_PER_YEAR);
}

export function dcBalance(settlement, contributions, rate) {
  return contributions.reduce((balance, contribution) => balance * (1 + rate) + contribution, settlement);
}

export function breakeven(target, settlement, contributions) {
  const minimum = contributions.at(-1) ?? settlement;
  const growsWithRate = contributions.length > 0 &&
    (settlement > 0 || contributions.slice(0, -1).some((amount) => amount > 0));
  const tolerance = Math.max(1, target, minimum) * Number.EPSILON * 8;
  const atMinimum = Math.abs(target - minimum) <= tolerance;
  if (!growsWithRate) {
    if (atMinimum) return { kind: 'equal' };
    return { kind: minimum > target ? 'above' : 'below' };
  }
  if (atMinimum) return { kind: 'root', rate: -1 };
  if (target < minimum) return { kind: 'above' };
  if (Math.abs(dcBalance(settlement, contributions, 0) - target) <= tolerance) {
    return { kind: 'root', rate: 0 };
  }

  let lower = -1;
  let upper = 1;
  while (dcBalance(settlement, contributions, upper) < target) upper = upper * 2 + 1;
  for (let step = 0; step < 80; step += 1) {
    const middle = lower + (upper - lower) / 2;
    if (dcBalance(settlement, contributions, middle) < target) lower = middle;
    else upper = middle;
  }
  return { kind: 'root', rate: lower + (upper - lower) / 2 };
}

export function simulate(input) {
  for (const [key, [min, max, integer]] of Object.entries(limits)) {
    const value = input[key];
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new RangeError(key);
    }
  }
  const { monthlyWage, annualExtras, dailyOrdinaryWage, averageDays, pastDays,
    years, wageGrowth, peakYears, peakCut, dcReturn } = input;
  if (peakYears > years) throw new RangeError('peakYears');

  const peakOffset = years - peakYears;
  const baseDailyWage = averageDailyWage(monthlyWage, annualExtras, averageDays, dailyOrdinaryWage);
  const baseAnnualWage = monthlyWage * MONTHS_PER_YEAR + annualExtras;
  const yearMultipliers = Array.from({ length: years }, (_, offset) => {
    if (offset < peakOffset || peakCut === 0) return (1 + wageGrowth) ** offset;
    return (1 + wageGrowth) ** Math.max(0, peakOffset - 1) * (1 - peakCut);
  });
  const dbAt = [1, ...yearMultipliers].map((multiplier, offset) =>
    dbBenefit(baseDailyWage * multiplier, pastDays + offset * DAYS_PER_YEAR));
  const contributions = yearMultipliers.map((multiplier) => baseAnnualWage * multiplier / MONTHS_PER_YEAR);
  const db = dbAt[years];
  const dbWithoutPeak = dbBenefit(baseDailyWage * (1 + wageGrowth) ** (years - 1),
    pastDays + years * DAYS_PER_YEAR);
  const candidates = contributions.map((_, offset) => ({
    offset,
    settlement: dbAt[offset],
    total: dcBalance(dbAt[offset], contributions.slice(offset), dcReturn),
  }));
  const bestTotal = Math.max(...candidates.map(({ total }) => total));
  const bestSwitch = {
    total: bestTotal,
    offsets: candidates.filter(({ total }) => Math.abs(total - bestTotal) < 0.005).map(({ offset }) => offset),
  };

  function scenario(offset) {
    const candidate = candidates[offset];
    return { ...candidate, threshold: breakeven(db, candidate.settlement, contributions.slice(offset)) };
  }

  const now = scenario(0);
  const peak = peakYears > 0 ? scenario(peakOffset) : null;
  let nowBalance = now.settlement;
  let peakBalance = peak?.settlement;
  const timeline = dbAt.map((amount, offset) => {
    const contribution = contributions[offset - 1] ?? 0;
    if (offset > 0) nowBalance = nowBalance * (1 + dcReturn) + contribution;
    if (peak && offset > peak.offset) peakBalance = peakBalance * (1 + dcReturn) + contribution;
    return {
      offset, contribution, db: amount, now: nowBalance,
      peak: peak ? (offset < peak.offset ? amount : peakBalance) : null,
    };
  });

  return { db, dbWithoutPeak, dbReduction: Math.max(0, dbWithoutPeak - db), now, peak, bestSwitch, timeline };
}
