const DAY_MS = 86_400_000;
const DAYS_PER_YEAR = 365;
const RETENTION_RATE = 0.02;
const RETENTION_YEARS = 5;
const RETENTION_LIMIT = 0.1;
const PENSION_PER_DOLLAR = 3 * 26 / 1000;
const NEW_RULES_START = Date.UTC(2025, 10, 1);

const PUBLISHED_INDEX = new Map([
  [Date.UTC(2025, 8, 20), 1],
  [Date.UTC(2026, 2, 20), 1.02],
  [Date.UTC(2026, 8, 20), 1.04],
]);

export const DEFAULTS = Object.freeze({
  roomPrice: 550_000,
  mpir: 8.51,
  entryDate: '2026-11-23',
  years: 3,
  radShare: 50,
  investmentRate: 4,
  grandfathered: false,
  indexDap: true,
  cpi: 2.5,
  pensionTaperAssets: 0,
  pensionCap: 0,
});

function checkRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-AU')} and ${max.toLocaleString('en-AU')}.`);
  }
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== value) {
    throw new RangeError('Enter a valid care start date between 2000 and 2099.');
  }
  return +date;
}

// A February 29 or month-end start uses the last day in shorter months.
function addMonths(start, months) {
  const date = new Date(start);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay));
}

function indexDay(date) {
  const year = new Date(date).getUTCFullYear();
  const march = Date.UTC(year, 2, 20);
  const september = Date.UTC(year, 8, 20);
  if (date >= september) return september;
  if (date >= march) return march;
  return Date.UTC(year - 1, 8, 20);
}

function indexLevel(day, cpi) {
  if (PUBLISHED_INDEX.has(day)) return PUBLISHED_INDEX.get(day);
  const date = new Date(day);
  const steps = (date.getUTCFullYear() - 2026) * 2 - (date.getUTCMonth() === 2 ? 1 : 0);
  return 1.04 * (1 + cpi / 100) ** (steps / 2);
}

function toCents(amount) {
  const scaled = amount * 100;
  return Math.round(scaled + Math.abs(scaled) * Number.EPSILON);
}

function retentionCents(deposit, start, stop) {
  const cap = Math.floor(deposit * RETENTION_LIMIT);
  let retained = 0;
  let periodStart = start;
  for (let month = 1; periodStart < stop && retained < cap; month++) {
    const periodEnd = Math.min(addMonths(start, month), stop);
    const daily = Math.round((deposit - retained) * RETENTION_RATE / DAYS_PER_YEAR);
    const days = (periodEnd - periodStart) / DAY_MS;
    retained = Math.min(cap, retained + daily * days);
    periodStart = periodEnd;
  }
  return retained;
}

function calculateStrategy(deposit, price, options, calendar) {
  const { mpir, investmentRate, pensionTaperAssets, pensionCap, cpi } = options;
  const { start, end, retentionEnd, days, years, indexDap } = calendar;
  const unpaid = price - deposit;
  const annualDap = unpaid * mpir / 100;
  const dailyDap = annualDap / DAYS_PER_YEAR;
  const maximumDaily = price * mpir / 100 / DAYS_PER_YEAR;
  const retained = retentionCents(toCents(deposit), start, retentionEnd) / 100;
  const pensionAnnual = Math.min(pensionCap, Math.min(deposit, pensionTaperAssets) * PENSION_PER_DOLLAR);
  const pensionDaily = pensionAnnual * years / days;
  const dailyGrowth = (1 + investmentRate / 100) ** (years / days);
  const forgoneReturn = deposit * ((1 + investmentRate / 100) ** years - 1);
  const referenceDay = indexDap ? indexDay(start) : null;
  let appliedDay = referenceDay;
  let activeDap = dailyDap;
  let indexChanges = 0;
  let dapPaid = 0;
  let dapAtExit = 0;
  let pensionAtExit = 0;

  for (let day = start; day < end; day += DAY_MS) {
    if (indexDap && dailyDap > 0) {
      const currentDay = indexDay(day);
      if (currentDay !== appliedDay) {
        appliedDay = currentDay;
        const ratio = indexLevel(currentDay, cpi) / indexLevel(referenceDay, cpi);
        const factor = Math.round(ratio * 10_000) / 10_000;
        if (factor > 1) {
          const indexedMaximum = toCents(maximumDaily * factor) / 100;
          const nextDap = toCents(indexedMaximum * unpaid / price) / 100;
          if (nextDap !== activeDap) indexChanges++;
          activeDap = nextDap;
        }
      }
    }
    dapPaid += activeDap;
    // Day-end flows are accumulated at the same after-tax return as liquid cash.
    dapAtExit = dapAtExit * dailyGrowth + activeDap;
    pensionAtExit = pensionAtExit * dailyGrowth + pensionDaily;
  }

  return {
    deposit, unpaid, dailyDap, annualDap,
    dapPaid, indexChanges, retention: retained,
    retentionPercent: deposit ? retained / deposit * 100 : 0,
    refund: deposit - retained,
    pensionAnnual, pensionTotal: pensionAnnual * years, forgoneReturn,
    netEstateCost: retained + forgoneReturn + dapAtExit - pensionAtExit,
  };
}

export function compareFunding(options = DEFAULTS) {
  const { roomPrice, mpir, entryDate, years, radShare, investmentRate, grandfathered,
    indexDap, cpi, pensionTaperAssets, pensionCap } = options;
  checkRange(roomPrice, 1, 10_000_000, 'Room price');
  checkRange(mpir, 0, 30, 'MPIR');
  checkRange(years, 1, 10, 'Stay length');
  checkRange(radShare, 0, 100, 'Combination RAD share');
  checkRange(investmentRate, -99, 50, 'After-tax return');
  checkRange(pensionTaperAssets, 0, 10_000_000, 'Assets in the taper band');
  checkRange(pensionCap, 0, 100_000, 'Annual pension headroom');

  if (typeof grandfathered !== 'boolean' || typeof indexDap !== 'boolean') {
    throw new RangeError('Choose valid accommodation and indexation settings.');
  }

  const applyIndex = indexDap && !grandfathered;
  if (applyIndex) checkRange(cpi, 0, 25, 'Projected annual CPI');
  const start = parseDate(entryDate);
  if (!grandfathered && start < NEW_RULES_START) {
    throw new RangeError('Use a start date on or after 1 November 2025 or select grandfathered arrangements.');
  }

  const wholeYears = Math.floor(years);
  const anniversary = addMonths(start, wholeYears * 12);
  const nextAnniversary = addMonths(start, (wholeYears + 1) * 12);
  const extraDays = Math.round((nextAnniversary - anniversary) / DAY_MS * (years - wholeYears));
  const end = anniversary + extraDays * DAY_MS;
  const days = (end - start) / DAY_MS;
  const retentionEnd = grandfathered ? start : Math.min(end, addMonths(start, RETENTION_YEARS * 12));
  const calendar = { start, end, retentionEnd, days, years, indexDap: applyIndex };
  const price = toCents(roomPrice) / 100;
  const comboDeposit = Math.round(toCents(price) * radShare / 100) / 100;
  const rad = calculateStrategy(price, price, options, calendar);
  const dap = calculateStrategy(0, price, options, calendar);
  const combo = calculateStrategy(comboDeposit, price, options, calendar);
  const strategies = { rad, dap, combo };
  const costCents = (strategy) => toCents(strategy.netEstateCost);
  const best = Math.min(...Object.values(strategies).map(costCents));
  const winners = Object.keys(strategies).filter((key) => costCents(strategies[key]) === best);
  return { ...strategies, days, retentionDays: (retentionEnd - start) / DAY_MS, winners };
}
