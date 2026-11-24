const CURRENT_WEEKLY_CAP = 123.25;
const EARNINGS_FRACTION = 0.8;
const PREVIOUS_WEEKLY_RATE = 118.75;
const PREVIOUS_EARNINGS_LIMIT = 125;
const MAX_WEEKS = 28;

export const crossoverEarnings = CURRENT_WEEKLY_CAP / EARNINGS_FRACTION;

function requireNumber(value, name, min, max, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${name} must be ${whole ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  }
}

// Round each weekly portion up to a penny, as in the HMRC rates tables.
// The small tolerance avoids rounding an exact penny up due to binary arithmetic.
function statutoryPence(weeklyRate, daysPerWeek, start, end) {
  if (end <= start) return 0;
  const firstWeekDays = Math.min(end - start, daysPerWeek - start % daysPerWeek);
  const remainingDays = end - start - firstWeekDays;
  const portion = days => Math.ceil(weeklyRate * 100 * days / daysPerWeek - 1e-9);
  return portion(firstWeekDays)
    + Math.floor(remainingDays / daysPerWeek) * portion(daysPerWeek)
    + portion(remainingDays % daysPerWeek);
}

export function calculateSSP({
  averageWeeklyEarnings,
  qualifyingDaysPerWeek,
  sickDays,
  fullPayDays = 0,
  incomeTaxRate = 0,
  nationalInsuranceRate = 0,
}) {
  requireNumber(averageWeeklyEarnings, 'Average weekly earnings', 0, 1000000);
  requireNumber(qualifyingDaysPerWeek, 'Qualifying workdays per week', 1, 7, true);
  requireNumber(sickDays, 'Qualifying sick days', 1, 140, true);
  requireNumber(fullPayDays, 'Company full-pay days', 0, sickDays, true);
  requireNumber(incomeTaxRate, 'Income Tax rate', 0, 100);
  requireNumber(nationalInsuranceRate, 'National Insurance rate', 0, 100);
  const deductionRate = (incomeTaxRate + nationalInsuranceRate) / 100;
  if (deductionRate > 1) throw new RangeError('Combined deduction rates must be 100% or less.');

  const daysPerWeek = qualifyingDaysPerWeek;
  const fullPayPence = Math.round(averageWeeklyEarnings * 100 * fullPayDays / daysPerWeek);

  function period(weeklyRate, waitingDays, earningsEligible) {
    const statutoryDays = weeklyRate > 0 ? Math.min(sickDays - waitingDays, MAX_WEEKS * daysPerWeek) : 0;
    const end = waitingDays + statutoryDays;
    const total = statutoryPence(weeklyRate, daysPerWeek, waitingDays, end);
    const included = statutoryPence(weeklyRate, daysPerWeek, waitingDays, Math.min(end, fullPayDays));
    const standalone = total - included;
    const gross = Math.max(fullPayPence, included) + standalone;
    const net = Math.round(gross * (1 - deductionRate) + 1e-9);
    return { weeklyRate, waitingDays, earningsEligible, statutoryDays, total, included, standalone, gross, net };
  }

  const current = period(Math.min(CURRENT_WEEKLY_CAP, EARNINGS_FRACTION * averageWeeklyEarnings), 0, true);
  const oldEligible = averageWeeklyEarnings >= PREVIOUS_EARNINGS_LIMIT;
  // A continuous spell of three or fewer qualifying days had no payable days
  // even if weekends made it long enough to meet the old four-calendar-day rule.
  const previous = period(oldEligible ? PREVIOUS_WEEKLY_RATE : 0, oldEligible ? Math.min(3, sickDays) : 0, oldEligible);

  function amounts({ weeklyRate, waitingDays, earningsEligible, statutoryDays, total, included, standalone, gross, net }) {
    return {
      weeklyRate,
      dailyRate: weeklyRate / daysPerWeek,
      waitingDays,
      earningsEligible,
      statutoryDays,
      statutoryTotal: total / 100,
      statutoryIncluded: included / 100,
      standaloneSSP: standalone / 100,
      grossSickPay: gross / 100,
      netSickPay: net / 100,
    };
  }

  return {
    current: amounts(current),
    previous: amounts(previous),
    statutoryChange: (current.total - previous.total) / 100,
    grossChange: (current.gross - previous.gross) / 100,
    netChange: (current.net - previous.net) / 100,
  };
}
