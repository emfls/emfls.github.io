export const FORM_8840_MAX_DAYS = 182;
export const REPEATABLE_ANNUAL_DAYS = 121;

export const provinces = Object.freeze({
  ON: Object.freeze({ days: 153, window: 'any 12-month period' }),
  QC: Object.freeze({ days: 182, window: 'the 2026 calendar year', countsAbsences: true }),
  BC: Object.freeze({ days: 183, window: 'the 2026 calendar year', estimate: true }),
  AB: Object.freeze({ days: 183, window: 'any 12-month period' }),
  MB: Object.freeze({ days: 183, window: 'the 2026 calendar year' }),
  NS: Object.freeze({ days: 183, window: 'the 2026 calendar year' })
});

function requireDays(days, max, label) {
  if (!Number.isInteger(days) || days < 0 || days > max) {
    throw new RangeError(`${label} must be a whole number from 0 to ${max}.`);
  }
}

export function calculateSPT(days2026, days2025, days2024, closerConnection = 'unknown') {
  requireDays(days2026, 365, '2026 U.S. days');
  requireDays(days2025, 365, '2025 U.S. days');
  requireDays(days2024, 366, '2024 U.S. days');
  if (!['unknown', 'yes', 'no'].includes(closerConnection)) {
    throw new RangeError('Choose a closer-connection answer.');
  }

  // Integer sixths preserve exact fractions at the 183-day boundary.
  const priorSixths = 2 * days2025 + days2024;
  const weightedSixths = 6 * days2026 + priorSixths;
  const lastBelow183 = 183 * 6 - 1;
  const weightedOnlyMaxDays = Math.floor((lastBelow183 - priorSixths) / 6);
  const maxDaysWithoutSPT = Math.max(30, weightedOnlyMaxDays);
  const meetsSPT = days2026 >= 31 && weightedSixths > lastBelow183;
  const barredByDays = days2026 > FORM_8840_MAX_DAYS;

  let verdict = 'NON_RESIDENT_SAFE';
  if (barredByDays) {
    verdict = 'US_TAX_RESIDENT_TREATY_8833_ONLY';
  } else if (meetsSPT) {
    verdict = closerConnection === 'no' ? 'SPT_MET_NO_CLOSER_CONNECTION' : 'FORM_8840_REQUIRED';
  }

  return {
    weightedSixths,
    weightedDays: weightedSixths / 6,
    wholeWeightedDays: Math.floor(weightedSixths / 6),
    meetsSPT,
    verdict,
    barredByDays,
    closerConnection,
    weightedOnlyMaxDays,
    maxDaysWithoutSPT,
    remainingWithoutSPT: Math.max(0, maxDaysWithoutSPT - days2026),
    remainingUnder8840DayCap: Math.max(0, FORM_8840_MAX_DAYS - days2026)
  };
}

export function checkVisitorDays(rollingDays) {
  if (rollingDays === null) return null;
  requireDays(rollingDays, 365, 'Rolling 365-day U.S. total');
  return rollingDays > 182;
}

export function checkHealthCoverage(province, days) {
  if (!Object.hasOwn(provinces, province)) throw new RangeError('Choose a province.');
  const rule = provinces[province];
  const max = rule.window === 'any 12-month period' ? 366 : 365;
  requireDays(days, max, 'Provincial day count');
  const margin = rule.countsAbsences ? rule.days - days : days - rule.days;
  return { margin, meetsBaseline: margin >= 0, estimate: rule.estimate === true };
}
