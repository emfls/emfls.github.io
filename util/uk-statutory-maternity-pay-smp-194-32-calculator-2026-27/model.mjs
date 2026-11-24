export const SMP_CAP = 194.32;
export const LOWER_EARNINGS_LIMIT = 129;

const round = amount => Math.round(amount * 100 + 1e-8) / 100;
const sum = (rows, key) => round(rows.reduce((total, row) => total + row[key], 0));
const positive = value => Math.max(0, value);

export function statutoryWeeklyPay(awe, week, serviceMet) {
  if (!serviceMet || awe < LOWER_EARNINGS_LIMIT || week < 1 || week > 39) return 0;
  return round(week <= 6 ? awe * 0.9 : Math.min(SMP_CAP, awe * 0.9));
}

export function payrollDeductions(gross, frequency, pensionPercent) {
  const monthly = frequency === 'monthly';
  const periods = monthly ? 12 : 52;
  const pension = round(gross * pensionPercent / 100);
  const taxable = positive((gross - pension) * periods - 12570);
  const tax = round((
    Math.min(taxable, 37700) * 0.2 +
    Math.min(positive(taxable - 37700), 87440) * 0.4 +
    positive(taxable - 125140) * 0.45
  ) / periods);
  const primary = monthly ? 1048 : 242;
  const upper = monthly ? 4189 : 967;
  const ni = round(positive(Math.min(gross, upper) - primary) * 0.08 + positive(gross - upper) * 0.02);
  return { tax, ni, pension };
}

function addCash(row, deductions) {
  const gross = round(row.smp + row.topUp + row.kit);
  const { tax, ni, pension } = deductions;
  return { ...row, gross, tax, ni, pension, net: round(gross - tax - ni - pension) };
}

export function calculateMaternity({
  awe, annualSalary, serviceMet, leaveWeeks, fullWeeks = 0, halfWeeks = 0,
  kitDays = 0, kitStartWeek = 12, kitDayPay, pensionPercent = 0,
  frequency = 'monthly', holidayDays = 28, workdays = 5,
}) {
  function check(value, min, max, label, integer = false) {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      const kind = integer ? 'a whole number' : 'a number';
      throw new RangeError(`${label} must be ${kind} from ${min} to ${max}.`);
    }
  }

  check(awe, 0, 1000000, 'Weekly earnings');
  check(annualSalary, 0, 52000000, 'Annual salary');
  check(leaveWeeks, 1, 52, 'Leave weeks', true);
  check(fullWeeks, 0, 52, 'Full-pay weeks', true);
  check(halfWeeks, 0, 52 - fullWeeks, 'Half-pay weeks', true);
  check(workdays, 1, 7, 'Working days per week', true);
  check(kitDays, 0, 10, 'KIT days', true);
  check(pensionPercent, 0, 100, 'Employee pension percentage');
  check(holidayDays, 0, 366, 'Annual holiday entitlement');
  if (frequency !== 'monthly' && frequency !== 'weekly') throw new RangeError('Choose a payroll frequency.');
  if (typeof serviceMet !== 'boolean') throw new TypeError('Confirm the qualifying-week service assumption.');

  const normalWeekly = annualSalary / 52;
  const dailyPay = normalWeekly / workdays;
  if (kitDays > 0) {
    check(kitStartWeek, 1, leaveWeeks, 'First KIT leave week', true);
    check(kitDayPay, 0, 1000000, 'Extra KIT pay per day');
    if (kitStartWeek + Math.ceil(kitDays / workdays) - 1 > leaveWeeks) {
      throw new RangeError('The KIT days extend past the planned leave. Choose an earlier eligible week or fewer days.');
    }
  }

  const weeks = Array.from({ length: 52 }, (_, index) => {
    const week = index + 1;
    const smp = statutoryWeeklyPay(awe, week, serviceMet);
    const policyPay = week <= fullWeeks ? normalWeekly : week <= fullWeeks + halfWeeks ? normalWeekly / 2 : 0;
    return { week, smp, topUp: positive(round(policyPay - smp)) };
  });

  const grossThrough = count => round(sum(weeks.slice(0, count), 'smp') + sum(weeks.slice(0, count), 'topUp'));
  const planned = weeks.slice(0, leaveWeeks).map(row => {
    const days = !kitDays || row.week < kitStartWeek
      ? 0
      : Math.min(workdays, positive(kitDays - (row.week - kitStartWeek) * workdays));
    const kit = days ? round(days * kitDayPay) : 0;
    const gross = round(row.smp + row.topUp + kit);
    const deductions = frequency === 'weekly' ? payrollDeductions(gross, frequency, pensionPercent) : { tax: 0, ni: 0, pension: 0 };
    return addCash({ ...row, kit }, deductions);
  });

  // Thirteen units make a planning month, and three units make a week.
  const months = Array.from({ length: 12 }, (_, index) => {
    const start = index * 13;
    const end = start + 13;
    const row = { month: index + 1, smp: 0, topUp: 0, kit: 0, tax: 0, ni: 0, pension: 0 };
    for (const week of planned) {
      const weekStart = (week.week - 1) * 3;
      if (frequency === 'weekly') {
        // Keep the week's deductions and wages together on the estimated payday.
        const payday = weekStart + 3;
        if (payday > start && payday <= end) {
          for (const key of ['smp', 'topUp', 'kit', 'tax', 'ni', 'pension']) row[key] += Math.round(week[key] * 100);
        }
        continue;
      }
      const elapsed = boundary => Math.min(3, positive(boundary - weekStart));
      for (const key of ['smp', 'topUp']) {
        const pennies = Math.round(week[key] * 100);
        row[key] += Math.round(pennies * elapsed(end) / 3) - Math.round(pennies * elapsed(start) / 3);
      }
      if (weekStart >= start && weekStart < end) row.kit += Math.round(week.kit * 100);
    }
    for (const key of ['smp', 'topUp', 'kit', 'tax', 'ni', 'pension']) row[key] /= 100;
    const gross = round(row.smp + row.topUp + row.kit);
    return addCash(row, frequency === 'monthly' ? payrollDeductions(gross, frequency, pensionPercent) : row);
  });

  const totals = Object.fromEntries(
    ['smp', 'topUp', 'kit', 'gross', 'tax', 'ni', 'pension', 'net'].map(key => [key, sum(months, key)]),
  );
  const accruedDays = holidayDays * leaveWeeks / 52;
  const normalGross = round(annualSalary / (frequency === 'monthly' ? 12 : 52));
  const normalPeriodNet = addCash(
    { smp: 0, topUp: normalGross, kit: 0 }, payrollDeductions(normalGross, frequency, pensionPercent),
  ).net;

  return {
    eligible: serviceMet && awe >= LOWER_EARNINGS_LIMIT,
    gross39: grossThrough(39), gross52: grossThrough(52), totals, months,
    accruedDays, holidayValue: round(accruedDays * dailyPay),
    normalMonthlyNet: round(normalPeriodNet * (frequency === 'weekly' ? 52 / 12 : 1)),
  };
}
