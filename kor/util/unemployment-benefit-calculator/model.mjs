const hourlyMinimum = {2026: 10_320, 2027: 10_700};
const dailyCap = 68_100;
const benefitDays = [
  [120, 150, 180, 210, 240],
  [120, 180, 210, 240, 270],
];

export function calculateUnemployment({year, dailyWage, hours, age, disabled = false, insuredMonths}) {
  if (![year, dailyWage, hours, age, insuredMonths].every(Number.isSafeInteger) ||
      !Object.hasOwn(hourlyMinimum, year) || dailyWage <= 0 || hours < 1 || hours > 8 ||
      age < 0 || age > 130 || insuredMonths < 0 || typeof disabled !== 'boolean') {
    throw new RangeError('이직 연도와 임금, 근로시간, 나이, 가입기간을 확인하세요.');
  }

  const hourlyWage = hourlyMinimum[year];
  const lower = hourlyWage * hours * 4 / 5;
  const upper = Math.max(dailyCap, lower);
  // Cap the base wage before multiplication. Retain whole won.
  const wageBased = Math.floor(Math.min(dailyWage, 113_500) * 3 / 5);
  const daily = Math.max(lower, wageBased);
  const band = [12, 36, 60, 120].filter(months => insuredMonths >= months).length;
  const days = benefitDays[Number(age >= 50 || disabled)][band];
  return {hourlyWage, lower, upper, daily, days, total: daily * days, thirtyDays: daily * 30};
}
