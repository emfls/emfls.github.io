export const MINIMUM_HOURLY_WAGE = 10320;

function check(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(name);
  }
}

// One accrual period. Prior balances and compensation eligibility are separate.
export function legalLeaveDays({ years, attendance, perfectMonths }) {
  check(years, 'years', { integer: true });
  check(attendance, 'attendance', { max: 100 });
  check(perfectMonths, 'perfectMonths', { max: 12, integer: true });

  if (years === 0) return Math.min(perfectMonths, 11);
  if (attendance < 80) return perfectMonths;
  return Math.min(15 + Math.floor((years - 1) / 2), 25);
}

export function compareWages({
  basePay, fixedPay, annualBonus, monthlyHours, dailyHours, unusedDays,
  years, attendance, perfectMonths,
}) {
  check(basePay, 'basePay');
  check(fixedPay, 'fixedPay');
  check(annualBonus, 'annualBonus');
  check(monthlyHours, 'monthlyHours', { min: 0.01 });
  check(dailyHours, 'dailyHours', { min: 0.01, max: 8 });
  check(unusedDays, 'unusedDays');

  const legalDays = legalLeaveDays({ years, attendance, perfectMonths });
  const monthlyBonus = annualBonus / 12;
  const previousMonthly = basePay + fixedPay;
  const currentMonthly = previousMonthly + monthlyBonus;

  // Retain fractional won through all calculations. Format only in the UI.
  function amounts(monthly) {
    const hourly = monthly / monthlyHours;
    const daily = hourly * dailyHours;
    return {
      monthly,
      hourly,
      daily,
      leave: daily * unusedDays,
      overtime: hourly * 1.5,
      night: hourly * 0.5,
      holiday: hourly * 1.5,
      holidayExtra: hourly * 2,
    };
  }

  return {
    legalDays,
    monthlyBonus,
    previous: amounts(previousMonthly),
    current: amounts(currentMonthly),
    increase: amounts(monthlyBonus),
    belowMinimum: currentMonthly < MINIMUM_HOURLY_WAGE * monthlyHours,
  };
}
