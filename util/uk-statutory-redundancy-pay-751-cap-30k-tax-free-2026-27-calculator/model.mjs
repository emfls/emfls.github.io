const WEEKLY_CAPS = new Map([['2025/26', 719], ['2026/27', 751]]);
const NI_THRESHOLDS = new Map([
  ['weekly', [24200, 96700]],
  ['fourWeekly', [96800, 386800]],
  ['monthly', [104800, 418900]],
]);
const EXEMPTION = 3000000; // Pence
const MAX_AMOUNT = 1_000_000_000;

function pence(amount, label) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT ||
      Math.round(amount * 100) / 100 !== amount) {
    throw new RangeError(`Enter ${label} between £0 and £1 billion, to the nearest penny.`);
  }
  return Math.round(amount * 100);
}

function class1Pence(earnings, frequency) {
  const thresholds = NI_THRESHOLDS.get(frequency);
  if (!thresholds) throw new RangeError('Choose a supported pay frequency.');
  const [primary, upper] = thresholds;
  const mainBand = Math.max(0, Math.min(earnings, upper) - primary);
  const upperBand = Math.max(0, earnings - upper);
  return Math.round((mainBand * 8 + upperBand * 2) / 100);
}

export function employeeNationalInsurance(earnings, frequency) {
  return class1Pence(pence(earnings, 'NI-able earnings'), frequency) / 100;
}

export function calculateRedundancy({
  period, age, serviceYears, weeklyPay, enhanced, pilon, holiday, penp = 0,
  incomeTaxRate, payFrequency, otherPeriodPay,
}) {
  const weeklyCap = WEEKLY_CAPS.get(period);
  if (!weeklyCap) throw new RangeError('Choose a supported redundancy period.');
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw new RangeError('Enter age in whole years, from 0 to 120.');
  }
  if (!Number.isInteger(serviceYears) || serviceYears < 0 || serviceYears > age) {
    throw new RangeError('Enter complete years of service, from 0 up to your age.');
  }
  if (![20, 40, 45].includes(incomeTaxRate)) {
    throw new RangeError('Choose a supported marginal Income Tax rate.');
  }
  const cappedPay = Math.min(pence(weeklyPay, 'gross weekly pay'), weeklyCap * 100);
  const enhancement = pence(enhanced, 'enhanced severance');
  const notice = pence(pilon, 'PILON');
  const holidayPay = pence(holiday, 'holiday pay');
  const noticeFromAward = Math.min(enhancement, pence(penp, 'additional PENP'));
  const existingEarnings = pence(otherPeriodPay, 'other NI-able pay');

  const countedYears = serviceYears >= 2 ? Math.min(serviceYears, 20) : 0;
  const bandYears = { under22: 0, age22To40: 0, age41Plus: 0 };
  for (let year = 1; year <= countedYears; year++) {
    // Age at the start of each complete year, counting back from the relevant date.
    const ageAtStart = age - year;
    if (ageAtStart >= 41) bandYears.age41Plus++;
    else if (ageAtStart >= 22) bandYears.age22To40++;
    else bandYears.under22++;
  }
  const weeks = bandYears.under22 * 0.5 + bandYears.age22To40 + bandYears.age41Plus * 1.5;
  const statutory = Math.round(weeks * cappedPay);
  const terminationAward = statutory + enhancement - noticeFromAward;
  const gross = statutory + enhancement + notice + holidayPay;
  const exempt = Math.min(EXEMPTION, terminationAward);
  const excess = terminationAward - exempt;
  const earnings = notice + holidayPay + noticeFromAward;
  const excessTax = Math.round(excess * incomeTaxRate / 100);
  const earningsTax = Math.round(earnings * incomeTaxRate / 100);
  const ni = class1Pence(existingEarnings + earnings, payFrequency) -
    class1Pence(existingEarnings, payFrequency);
  const deductions = excessTax + earningsTax + ni;

  return {
    weeklyCap,
    maximumStatutoryPay: weeklyCap * 30,
    cappedWeeklyPay: cappedPay / 100,
    countedYears,
    bandYears,
    weeks,
    statutoryPay: statutory / 100,
    grossPackage: gross / 100,
    taxFree: exempt / 100,
    taxableExcess: excess / 100,
    pilon: notice / 100,
    holiday: holidayPay / 100,
    penpReclassified: noticeFromAward / 100,
    taxableEarnings: earnings / 100,
    taxableTotal: (excess + earnings) / 100,
    excessIncomeTax: excessTax / 100,
    earningsIncomeTax: earningsTax / 100,
    employeeNI: ni / 100,
    employerClass1A: Math.round(excess * 15 / 100) / 100,
    totalDeductions: deductions / 100,
    netCash: (gross - deductions) / 100,
  };
}
