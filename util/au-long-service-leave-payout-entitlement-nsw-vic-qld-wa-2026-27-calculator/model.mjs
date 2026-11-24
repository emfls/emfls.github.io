const WEEKS_PER_YEAR = 52;
const SG_RATE = 0.12;
const SG_BASE = 270830;
const LUMP_SUM_A_RATE = 0.32;
const PERIODS = Object.freeze({ weekly: 52, fortnightly: 26, monthly: 12 });
const REASONS = new Set([
  'resignation', 'illness', 'necessity', 'redundancy', 'otherDismissal',
  'illnessDismissal', 'conduct', 'misconduct', 'unfairDismissal',
  'qualifyingExpiry', 'invalidity', 'earlyRetirement', 'death',
]);
const NSW_PRO_RATA = new Set([
  'illness', 'necessity', 'redundancy', 'otherDismissal', 'illnessDismissal',
  'conduct', 'unfairDismissal', 'invalidity', 'death',
]);
const QLD_PRO_RATA = new Set([
  'illness', 'necessity', 'redundancy', 'otherDismissal', 'illnessDismissal',
  'unfairDismissal', 'qualifyingExpiry', 'invalidity', 'death',
]);
const LUMP_SUM_A_REASONS = new Set(['redundancy', 'invalidity', 'earlyRetirement']);

// ATO 2026–27 Schedule 1, Scale 2. Columns are upper limit, a and b for y = ax − b.
const SCALE_2 = [
  [362, 0, 0], [538, 0.15, 54.3462], [673, 0.25, 108.2135],
  [721, 0.17, 54.3473], [865, 0.179, 60.8377], [1282, 0.3227, 185.1935],
  [2596, 0.32, 181.7319], [3653, 0.39, 363.4627], [Infinity, 0.47, 655.7704],
];

function validNumber(value, maximum) {
  return Number.isFinite(value) && value >= 0 && value <= maximum;
}

function cents(value) {
  const scaled = value * 100;
  return Math.round(scaled + scaled * Number.EPSILON) / 100;
}

export function regularWithholding(pay, frequency) {
  // Convert via integer cents so exact weekly dollar boundaries survive division.
  const payCents = Math.round(pay * 100);
  let weeklyDollars = Math.floor(payCents / 100);
  if (frequency === 'fortnightly') weeklyDollars = Math.floor(payCents / 200);
  if (frequency === 'monthly') {
    const adjusted = payCents + (payCents % 100 === 33 ? 1 : 0);
    weeklyDollars = Math.floor(adjusted * 3 / 1300);
  }
  const x = weeklyDollars + 0.99;
  const [, a, b] = SCALE_2.find(([limit]) => x < limit);
  const weekly = Math.round(x * a - b);
  return Math.round(weekly * WEEKS_PER_YEAR / PERIODS[frequency]);
}

export function schedule7Withholding(gross, normalGross, frequency, treatment) {
  if (gross === 0 || treatment === 'death') return 0;
  if (treatment === 'lumpSumA') return Math.round(gross * LUMP_SUM_A_RATE);

  const periods = PERIODS[frequency];
  const extra = Math.floor(gross / periods);
  const marginal = (regularWithholding(normalGross + extra, frequency)
    - regularWithholding(normalGross, frequency)) * periods;
  return gross < 300 ? Math.min(marginal, Math.round(gross * LUMP_SUM_A_RATE)) : marginal;
}

function entitlement(state, years, serviceWeeks, reason) {
  if (state === 'VIC') {
    const accrued = serviceWeeks / 60;
    const accessible = years >= 7 ? accrued : 0;
    return { accrued, accessible, payable: accessible };
  }

  const rate = state === 'QLD' ? 8.6667 / 10 : 13 / 15;
  const milestone = years < 10 ? 0 : 10 + 5 * Math.floor((years - 10) / 5);
  const accrualYears = state === 'WA' && years >= 10 ? Math.floor(years) : years;
  const accrued = accrualYears * rate;
  const accessible = state === 'QLD' && years >= 15 ? accrued : milestone * rate;
  if (milestone) {
    const payable = state === 'WA' && reason === 'misconduct' ? accessible : accrued;
    return { accrued, accessible, payable };
  }

  let qualifies;
  if (state === 'NSW') qualifies = years >= 5 && NSW_PRO_RATA.has(reason);
  if (state === 'QLD') qualifies = years >= 7 && QLD_PRO_RATA.has(reason);
  if (state === 'WA') qualifies = years >= 7 && reason !== 'misconduct';
  return { accrued, accessible, payable: qualifies ? accrued : 0 };
}

export function estimatePayout({
  state, serviceYears, serviceWeeks = serviceYears * WEEKS_PER_YEAR, reason, weeklyHours,
  payBasis, pay, leaveUsed, frequency, normalGross, qualifyingEarningsYtd = 0,
}) {
  if (!['NSW', 'VIC', 'QLD', 'WA'].includes(state) || !REASONS.has(reason)
    || !['annual', 'weekly', 'hourly'].includes(payBasis) || !Object.hasOwn(PERIODS, frequency)
    || !validNumber(serviceYears, 80) || !validNumber(serviceWeeks, 4200)
    || !validNumber(weeklyHours, 168) || weeklyHours === 0
    || !validNumber(pay, 10000000) || pay === 0 || !validNumber(leaveUsed, 100)
    || !validNumber(qualifyingEarningsYtd, 10000000)
    || (normalGross !== undefined && !validNumber(normalGross, 10000000))) {
    return null;
  }

  let weeklyRate = pay;
  if (payBasis === 'annual') weeklyRate = pay / WEEKS_PER_YEAR;
  if (payBasis === 'hourly') weeklyRate = pay * weeklyHours;

  const { accrued, accessible, payable } = entitlement(state, serviceYears, serviceWeeks, reason);
  const payableWeeks = Math.max(0, payable - leaveUsed);
  const takeableWeeks = reason === 'death' ? 0 : Math.max(0, accessible - leaveUsed);
  const eligibility = accessible > 0 ? 'FULL_ENTITLEMENT'
    : payable > 0 ? 'PRO_RATA_ELIGIBLE' : 'NOT_YET_ELIGIBLE';
  const gross = cents(payableWeeks * weeklyRate);
  let treatment = 'marginal';
  if (reason === 'death') treatment = 'death';
  if (LUMP_SUM_A_REASONS.has(reason)) treatment = 'lumpSumA';
  const taxWithheld = schedule7Withholding(gross,
    normalGross ?? cents(weeklyRate * WEEKS_PER_YEAR / PERIODS[frequency]), frequency, treatment);
  const sgHeadroom = Math.max(0, SG_BASE - qualifyingEarningsYtd);

  return {
    eligibility, weeklyRate, treatment,
    accruedWeeks: accrued, accruedHours: accrued * weeklyHours,
    payableWeeks, payableHours: payableWeeks * weeklyHours,
    gross, taxWithheld, net: cents(gross - taxWithheld),
    takeableWeeks, superOnLeave: cents(Math.min(takeableWeeks * weeklyRate, sgHeadroom) * SG_RATE),
    superOnPayout: 0,
  };
}
