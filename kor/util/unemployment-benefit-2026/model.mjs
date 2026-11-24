export const RULES = Object.freeze({
  2025: Object.freeze({ minimumWage: 10030, dailyCap: 66000 }),
  2026: Object.freeze({ minimumWage: 10320, dailyCap: 68100 }),
});

export function dailyBenefit(averageWage, hours, year = 2026) {
  const rule = RULES[year];
  if (!rule || ![2025, 2026].includes(year) || !Number.isFinite(averageWage) || averageWage <= 0 ||
      !Number.isInteger(hours) || hours < 1 || hours > 8) {
    throw new RangeError('Invalid wage, statutory hours, or year');
  }
  const floor = rule.minimumWage * 4 / 5 * hours;
  const base = averageWage / 5 * 3;
  const limit = base < floor ? 'floor' : base > rule.dailyCap ? 'cap' : 'none';
  return { amount: Math.min(rule.dailyCap, Math.max(floor, base)), floor, limit };
}

export function benefitDays(age, insuredMonths, disabled = false) {
  if (!Number.isSafeInteger(age) || age < 0 || !Number.isSafeInteger(insuredMonths) ||
      insuredMonths < 0 || typeof disabled !== 'boolean') {
    throw new RangeError('Invalid age, insured months, or disability status');
  }
  const thresholds = [120, 60, 36, 12, 0];
  const standard = [240, 210, 180, 150, 120];
  const extended = [270, 240, 210, 180, 120];
  const index = thresholds.findIndex((threshold) => insuredMonths >= threshold);
  return (age >= 50 || disabled ? extended : standard)[index];
}

export function estimateBenefit({ averageWage, hours, age, insuredMonths, disabled = false }) {
  const daily = dailyBenefit(averageWage, hours);
  const previous = dailyBenefit(averageWage, hours, 2025).amount;
  const days = benefitDays(age, insuredMonths, disabled);
  return {
    daily,
    days,
    month28: daily.amount * 28,
    month30: daily.amount * 30,
    total: daily.amount * days,
    previous,
    increaseDaily: daily.amount - previous,
    increase30: daily.amount * 30 - previous * 30,
    increaseTotal: daily.amount * days - previous * days,
  };
}

export function estimateReemployment({
  daily, days, paidDays, elapsedDays, employmentMonths, seniorException = false,
}) {
  if (!Number.isFinite(daily) || daily <= 0 || !Number.isSafeInteger(days) || days <= 0 ||
      !Number.isSafeInteger(paidDays) || paidDays < 0 || paidDays > days ||
      !Number.isSafeInteger(elapsedDays) || elapsedDays < 0 ||
      !Number.isSafeInteger(employmentMonths) || employmentMonths < 0 ||
      typeof seniorException !== 'boolean') {
    throw new RangeError('Invalid reemployment scenario');
  }
  const remaining = days - paidDays;
  const minimumRemaining = Math.ceil(days / 2);
  const requiredMonths = seniorException ? 6 : 12;
  const meetsTiming = elapsedDays > 14;
  const meetsRemaining = remaining >= minimumRemaining;
  const meetsEmployment = employmentMonths >= requiredMonths;
  const amount = meetsTiming && meetsRemaining && meetsEmployment ? daily * remaining / 2 : 0;
  return { remaining, minimumRemaining, requiredMonths, meetsTiming, meetsRemaining, meetsEmployment, amount };
}
