const FBAR_THRESHOLD = 10_000;
const FBAR_NON_WILLFUL_CAP = 16_536;
const FBAR_WILLFUL_DOLLAR_CAP = 165_353;
const FATCA_INITIAL = 10_000;
const FATCA_MAX_ADDITIONAL = 50_000;
const FATCA_NOTICE_WINDOW_DAYS = 90;
const MAX_AMOUNT = Number.MAX_SAFE_INTEGER / 100;

const FATCA_THRESHOLDS = {
  domestic: { separate: { yearEnd: 50_000, peak: 75_000 }, joint: { yearEnd: 100_000, peak: 150_000 } },
  abroad: { separate: { yearEnd: 200_000, peak: 300_000 }, joint: { yearEnd: 400_000, peak: 600_000 } },
};

function checkAmount(value) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
    throw new RangeError('Enter nonnegative dollar amounts within the supported range.');
  }
}

export function calculate({
  filingStatus, residence, filesIncomeTaxReturn, fbarPeak, fatcaYearEnd, fatcaPeak,
  missedFbarYears, missedFatcaYears, violationBalance, daysSinceNotice, streamlinedBase,
}) {
  if (!['domestic', 'abroad'].includes(residence) ||
      !['separate', 'joint'].includes(filingStatus) ||
      typeof filesIncomeTaxReturn !== 'boolean') {
    throw new RangeError('Select a valid filing profile.');
  }

  [fbarPeak, fatcaYearEnd, fatcaPeak, violationBalance, streamlinedBase].forEach(checkAmount);
  if (fatcaPeak < fatcaYearEnd) {
    throw new RangeError('The Form 8938 peak must be at least as high as the year-end value.');
  }
  if ([missedFbarYears, missedFatcaYears, daysSinceNotice].some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError('Enter nonnegative whole numbers for years and notice days.');
  }

  const fatcaThresholds = { ...FATCA_THRESHOLDS[residence][filingStatus] };
  const continuationPeriods = Math.ceil(Math.max(0, daysSinceNotice - FATCA_NOTICE_WINDOW_DAYS) / 30);
  const fatcaAdditional = Math.min(FATCA_MAX_ADDITIONAL, continuationPeriods * 10_000);
  const nonWillful = missedFbarYears * FBAR_NON_WILLFUL_CAP;
  const willful = missedFbarYears * Math.max(FBAR_WILLFUL_DOLLAR_CAP, violationBalance / 2);
  const fatcaMaximum = missedFatcaYears * (FATCA_INITIAL + FATCA_MAX_ADDITIONAL);

  [nonWillful, willful, fatcaMaximum].forEach(checkAmount);
  return {
    fbarRequired: fbarPeak > FBAR_THRESHOLD,
    fatcaRequired: filesIncomeTaxReturn &&
      (fatcaYearEnd > fatcaThresholds.yearEnd || fatcaPeak > fatcaThresholds.peak),
    fatcaThresholds,
    nonWillful,
    willful,
    fatcaMaximum,
    fatcaNoticeScenario: missedFatcaYears * (FATCA_INITIAL + fatcaAdditional),
    sdop: streamlinedBase / 20,
    sfop: 0,
  };
}
