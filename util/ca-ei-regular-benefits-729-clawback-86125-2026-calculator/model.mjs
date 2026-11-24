const maximumInsurableEarnings = 68_900;
const repaymentRate = 0.30;

export const EI_2026 = Object.freeze({
  maximumInsurableEarnings,
  maximumWeeklyInsurableEarnings: maximumInsurableEarnings / 52,
  benefitRate: 0.55,
  maximumWeeklyBenefit: 729,
  standardWaitingWeeks: 1,
  workEarningsThresholdRate: 0.90,
  workDeductionRate: 0.50,
  repaymentThreshold: 1.25 * maximumInsurableEarnings,
  repaymentRate,
});

const minimumHoursByBand = [700, 665, 630, 595, 560, 525, 490, 455, 420, 420, 420, 420];

// Schedule I, in 35-hour bands from 420 through 1820+. Each row increases
// by two weeks per unemployment band, capped at 45, with ineligible cells
// excluded by minimumHoursByBand. Early rows have implied bases.
const baseWeeksByHourBand = [
  10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17,
  18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
];

function validateNumber(value, label, { min = 0, max = 1_000_000_000, whole = false } = {}) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    const range = `between ${min.toLocaleString('en-CA')} and ${max.toLocaleString('en-CA')}`;
    throw new RangeError(`${label} must be ${whole ? 'a whole number ' : ''}${range}.`);
  }
}

function validateToggle(value, label) {
  if (typeof value !== 'boolean') throw new RangeError(`${label} must be true or false.`);
}

export function standardEntitlement(regionalRate, hours) {
  validateNumber(regionalRate, 'Regional unemployment rate', { max: 100 });
  validateNumber(hours, 'Insurable hours', { whole: true });
  const band = Math.min(11, Math.max(0, Math.ceil(regionalRate) - 6));
  const requiredHours = minimumHoursByBand[band];
  const bestWeeks = Math.max(14, 22 - band);
  if (hours < requiredHours) return { requiredHours, bestWeeks, payableWeeks: 0 };
  const hourBand = Math.min(baseWeeksByHourBand.length - 1, Math.floor((hours - 420) / 35));
  const payableWeeks = Math.min(45, baseWeeksByHourBand[hourBand] + 2 * band);
  return { requiredHours, bestWeeks, payableWeeks };
}

export function estimateRepayment(netIncome, regularEI, firstTimeExempt) {
  validateNumber(netIncome, 'Adjusted 2026 net income', { min: -1_000_000_000 });
  validateNumber(regularEI, '2026 regular EI paid');
  validateToggle(firstTimeExempt, 'Prior-benefits exemption');

  const excessCents = Math.round(netIncome * 100) - EI_2026.repaymentThreshold * 100;
  const regularEICents = Math.round(regularEI * 100);
  if (firstTimeExempt || excessCents <= 0 || regularEICents === 0) {
    return { clawback: 0, rrspDeductionNeeded: 0 };
  }
  return {
    clawback: Math.round(repaymentRate * Math.min(regularEICents, excessCents)) / 100,
    rrspDeductionNeeded: excessCents / 100,
  };
}

export function estimateEI({
  averageWeeklyEarnings, regionalRate, hours, weeklyWorkEarnings, weeksInTaxYear,
  netIncome, firstTimeExempt, waitingPeriodWaived = false, fullWorkWeek = false,
  regularEIOverride = null,
}) {
  validateNumber(averageWeeklyEarnings, 'Best-weeks average earnings');
  validateNumber(weeklyWorkEarnings, 'Weekly work earnings');
  validateNumber(weeksInTaxYear, 'Weeks in the projection', { max: 53, whole: true });
  validateToggle(waitingPeriodWaived, 'Waiting-period waiver');
  validateToggle(fullWorkWeek, 'Full work week');

  const entitlement = standardEntitlement(regionalRate, hours);
  const { payableWeeks } = entitlement;
  const baseWeeklyBenefit = payableWeeks
    ? Math.min(EI_2026.maximumWeeklyBenefit, Math.round(averageWeeklyEarnings * EI_2026.benefitRate))
    : 0;
  const earningsCap = averageWeeklyEarnings * EI_2026.workEarningsThresholdRate;
  const deduction = EI_2026.workDeductionRate * Math.min(weeklyWorkEarnings, earningsCap)
    + Math.max(0, weeklyWorkEarnings - earningsCap);
  const weeklyDeduction = fullWorkWeek
    ? baseWeeklyBenefit
    : Math.min(baseWeeklyBenefit, Math.round(deduction));
  const weeklyBenefit = baseWeeklyBenefit - weeklyDeduction;

  const waitingWeeks = payableWeeks && !waitingPeriodWaived ? EI_2026.standardWaitingWeeks : 0;
  const weeksPaid = weeklyBenefit ? Math.min(payableWeeks, Math.max(0, weeksInTaxYear - waitingWeeks)) : 0;
  const projectedEI = weeklyBenefit * weeksPaid;
  const regularEI = regularEIOverride ?? projectedEI;
  const repayment = estimateRepayment(netIncome, regularEI, firstTimeExempt);
  return {
    ...entitlement, baseWeeklyBenefit, earningsCap, weeklyDeduction, weeklyBenefit,
    waitingWeeks, weeksPaid, projectedEI, regularEI, ...repayment,
    eiAfterRepayment: (Math.round(regularEI * 100) - Math.round(repayment.clawback * 100)) / 100,
  };
}
