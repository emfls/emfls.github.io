export const PERIOD_START = '2026-04-01';
export const PERIOD_END = '2027-03-31';
export const VALUATION_DATE = '2022-04-01';
export const PERIOD_DAYS = 365;

const DAY_MS = 86_400_000;
const ANNUAL_DEADLINE = '2026-04-30';

const BANDS = [
  { ceiling: 500_000, annualCharge: 0, label: '£500,000 or less' },
  { ceiling: 1_000_000, annualCharge: 4_600, label: 'Over £500,000 up to £1 million' },
  { ceiling: 2_000_000, annualCharge: 9_450, label: 'Over £1 million up to £2 million' },
  { ceiling: 5_000_000, annualCharge: 32_200, label: 'Over £2 million up to £5 million' },
  { ceiling: 10_000_000, annualCharge: 75_450, label: 'Over £5 million up to £10 million' },
  { ceiling: 20_000_000, annualCharge: 151_450, label: 'Over £10 million up to £20 million' },
  { ceiling: Infinity, annualCharge: 303_450, label: 'Over £20 million' }
];

const RELIEFS = new Set(['rental', 'development', 'trading', 'farmhouse', 'employees']);

export function getBand(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Enter a valid market value of £0 or more.');
  }
  return { ...BANDS.find(band => value <= band.ceiling) };
}

function dateString(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function readDate(value, label) {
  const time = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value < '0001-01-01' || !Number.isFinite(time) || dateString(time) !== value) {
    throw new RangeError('Enter a valid ' + label + '.');
  }
  return time;
}

function addMonths(time, months) {
  const date = new Date(time);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  const endOfMonth = new Date(date);
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, endOfMonth.getUTCDate()));
  return date.getTime();
}

export function estimateLateFiling({ deadline, assessedOn, taxPayable, includeDaily = true }) {
  const due = readDate(deadline, 'filing deadline');
  const assessed = readDate(assessedOn, 'filing or assessment date');
  if (!Number.isFinite(taxPayable) || taxPayable < 0) {
    throw new RangeError('Tax payable must be a non-negative amount.');
  }
  const penaltyDate = due + DAY_MS;
  const daysLate = Math.max(0, (assessed - due) / DAY_MS);
  const firstDaily = addMonths(penaltyDate, 3);
  const dailyDays = includeDaily ? Math.min(90, Math.max(0, (assessed - firstDaily) / DAY_MS + 1)) : 0;
  const initial = daysLate > 0 ? 100 : 0;
  const daily = dailyDays * 10;
  const further = Math.max(300, Math.round(taxPayable * 5) / 100);
  const sixMonths = assessed >= addMonths(penaltyDate, 6) ? further : 0;
  const twelveMonths = assessed >= addMonths(penaltyDate, 12) ? further : 0;
  return { daysLate, initial, dailyDays, daily, sixMonths, twelveMonths,
    total: Math.round((initial + daily + sixMonths + twelveMonths) * 100) / 100 };
}

export function calculateAted({
  value, acquisitionDate, disposalDate = '', relief = 'none', reliefConfirmed = false,
  reliefDays = null, sameReliefAlreadyFiled = false, assessedOn = '', includeDaily = true
}) {
  const band = getBand(value);
  const acquisition = readDate(acquisitionDate, 'acquisition date');
  const disposal = disposalDate ? readDate(disposalDate, 'disposal date') : Infinity;
  if (disposal < acquisition) {
    throw new RangeError('Disposal cannot be before acquisition.');
  }
  if (relief !== 'none' && !RELIEFS.has(relief)) {
    throw new RangeError('Select a valid relief type.');
  }
  const start = Date.parse(PERIOD_START);
  const end = Date.parse(PERIOD_END) + DAY_MS;
  const ownedDays = Math.max(0, (Math.min(disposal, end) - Math.max(acquisition, start)) / DAY_MS);
  const hasRelief = relief !== 'none' && reliefConfirmed === true;
  if (hasRelief && reliefDays !== null &&
      (!Number.isInteger(reliefDays) || reliefDays < 0 || reliefDays > ownedDays)) {
    throw new RangeError('Enter a whole number of qualifying days from 0 to ' + ownedDays + '.');
  }

  const valuationDate = acquisitionDate > VALUATION_DATE ? acquisitionDate : VALUATION_DATE;
  const inScope = band.annualCharge > 0 && ownedDays > 0;
  const relievedDays = inScope && hasRelief ? (reliefDays ?? ownedDays) : 0;
  const chargeableDays = inScope ? ownedDays - relievedDays : 0;
  const taxPayable = Math.floor(band.annualCharge * chargeableDays / PERIOD_DAYS);
  const fullyRelieved = inScope && chargeableDays === 0;
  const inYearAcquisition = acquisition > start && acquisition < end;
  let status = 'OUT_OF_SCOPE';
  let deadline = null;
  let deadlineRule = null;

  if (inScope) {
    if (fullyRelieved && inYearAcquisition && sameReliefAlreadyFiled === true) {
      status = 'RELIEF_RDR_ALREADY_FILED';
    } else {
      status = fullyRelieved ? 'RELIEF_RDR_REQUIRED_£0' : 'TAXABLE_ATED';
      // The acquisition date itself is the first of the 30 days.
      deadline = inYearAcquisition ? dateString(acquisition + 29 * DAY_MS) : ANNUAL_DEADLINE;
      deadlineRule = inYearAcquisition ? '30-day acquisition window' : 'Held on 1 April';
    }
  }

  const penalty = deadline && assessedOn
    ? estimateLateFiling({ deadline, assessedOn, taxPayable, includeDaily })
    : null;

  return { band, valuationDate, ownedDays, relievedDays, chargeableDays, taxPayable, status,
    deadline, deadlineRule, penalty };
}
