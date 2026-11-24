const SG_RATE = 0.12;
const PAYDAY_CAP = 270830;
const LEGACY_CAP = 62500;
const LEGACY_NOMINAL_RATE = 0.10;
const LEGACY_FEE = 20;
const DAY_MS = 86400000;

const LEGACY_QUARTERS = new Map([
  ['2025-07-01', { paymentDue: '2025-10-28', statementDue: '2025-11-28' }],
  ['2025-10-01', { paymentDue: '2026-01-28', statementDue: '2026-03-02' }],
  ['2026-01-01', { paymentDue: '2026-04-28', statementDue: '2026-05-28' }],
  ['2026-04-01', { paymentDue: '2026-07-28', statementDue: '2026-08-28' }]
]);

function roundMoney(value) {
  const cents = value * 100;
  return Math.round(cents + Number.EPSILON * Math.abs(cents)) / 100;
}

function checkNumber(value, name, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter ${name} between ${min.toLocaleString('en-AU')} and ${max.toLocaleString('en-AU')}.`);
  }
}

function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)
    ? date.getTime() / DAY_MS
    : NaN;
}

function compareCosts(contribution, grossCharge, taxRate, deductible) {
  const onTimeAfterTax = roundMoney(contribution - roundMoney(contribution * taxRate));
  const taxSaving = deductible ? roundMoney(grossCharge * taxRate) : 0;
  const afterTax = roundMoney(grossCharge - taxSaving);
  const extraCost = roundMoney(afterTax - onTimeAfterTax);
  return {
    contribution, onTimeAfterTax, grossCharge, taxSaving, afterTax, extraCost,
    extraPercent: onTimeAfterTax > 0 ? extraCost / onTimeAfterTax * 100 : null
  };
}

/** Compare a fully missed Payday Super contribution and a fully missed 2025–26 quarterly contribution. */
export function calculateComparison({
  qualifyingEarnings, priorQualifyingEarnings, paydayLateDays, annualGicPercent, upliftPercent,
  ordinaryTimeEarnings, salaryAndWages, legacyQuarter, lodgedOn, companyTaxPercent
}) {
  checkNumber(qualifyingEarnings, 'payday qualifying earnings (A$)', 0, 10000000);
  checkNumber(priorQualifyingEarnings, 'earlier qualifying earnings (A$)', 0, 10000000);
  checkNumber(paydayLateDays, 'calendar days of Payday Super accrual', 0, 3660);
  if (!Number.isInteger(paydayLateDays)) throw new RangeError('Enter a whole number of accrual days.');
  checkNumber(annualGicPercent, 'annual GIC (%)', 0, 100);
  checkNumber(upliftPercent, 'administrative uplift (%)', 0, 60);
  checkNumber(ordinaryTimeEarnings, 'quarterly ordinary time earnings (A$)', 0, 10000000);
  checkNumber(salaryAndWages, 'quarterly salary and wages (A$)', 0, 10000000);
  if (salaryAndWages < ordinaryTimeEarnings) {
    throw new RangeError('Quarterly salary and wages must be at least the ordinary time earnings.');
  }
  checkNumber(companyTaxPercent, 'company tax rate (%)', 0, 30);

  const quarter = LEGACY_QUARTERS.get(legacyQuarter);
  if (!quarter) throw new RangeError('Select a legacy quarter in 2025–26.');
  const lodgedDay = calendarDay(lodgedOn);
  if (!Number.isFinite(lodgedDay) || lodgedDay <= calendarDay(quarter.paymentDue)) {
    throw new RangeError(`Enter a legacy lodgment date after ${quarter.paymentDue}.`);
  }

  const taxRate = companyTaxPercent / 100;
  const availablePaydayBase = Math.max(0, PAYDAY_CAP - priorQualifyingEarnings);
  const paydayBase = Math.min(qualifyingEarnings, availablePaydayBase);
  const paydayShortfall = roundMoney(paydayBase * SG_RATE);
  const gicDailyRate = annualGicPercent / 100 / 365;
  const unroundedNotionalEarnings = paydayShortfall * Math.expm1(paydayLateDays * Math.log1p(gicDailyRate));
  const notionalEarnings = roundMoney(unroundedNotionalEarnings);
  const uplift = roundMoney((paydayShortfall + unroundedNotionalEarnings) * upliftPercent / 100);
  const paydayCharge = roundMoney(paydayShortfall + notionalEarnings + uplift);

  const legacyContribution = roundMoney(Math.min(ordinaryTimeEarnings, LEGACY_CAP) * SG_RATE);
  const legacyShortfall = roundMoney(Math.min(salaryAndWages, LEGACY_CAP) * SG_RATE);
  const interestEnd = lodgedDay > calendarDay(quarter.statementDue) ? lodgedOn : quarter.statementDue;
  const interestDays = calendarDay(interestEnd) - calendarDay(legacyQuarter);
  // All supported legacy quarters start in a 365-day calendar year.
  const interest = roundMoney(legacyShortfall * LEGACY_NOMINAL_RATE * interestDays / 365);
  const fee = legacyShortfall > 0 ? LEGACY_FEE : 0;
  const legacyCharge = roundMoney(legacyShortfall + interest + fee);

  return {
    payday: {
      ...compareCosts(paydayShortfall, paydayCharge, taxRate, true),
      shortfall: paydayShortfall, notionalEarnings, uplift
    },
    legacy: {
      ...compareCosts(legacyContribution, legacyCharge, taxRate, false),
      shortfall: legacyShortfall, interest, fee, interestDays, interestEnd, ...quarter
    }
  };
}
