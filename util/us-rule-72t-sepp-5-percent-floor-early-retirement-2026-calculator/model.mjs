// Single Life: 26 CFR 1.401(a)(9)-9(b), Table 1. Uniform Lifetime: Notice 2022-6, Appendix A.
// Life expectancy arrays begin at age 35 and extend through the possible lock period.
const LIFE = Object.freeze({
  single: Object.freeze([
  50.5, 49.6, 48.6, 47.7, 46.7, 45.7, 44.8, 43.8, 42.9, 41.9,
  41.0, 40.0, 39.0, 38.1, 37.1, 36.2, 35.3, 34.3, 33.4, 32.5,
  31.6, 30.6, 29.8, 28.9, 28.0, 27.1, 26.2, 25.4, 24.5, 23.7,
  ]),
  uniform: Object.freeze([
  63.3, 62.3, 61.3, 60.3, 59.4, 58.4, 57.4, 56.4, 55.4, 54.4,
  53.4, 52.4, 51.5, 50.5, 49.5, 48.5, 47.5, 46.5, 45.6, 44.6,
  43.6, 42.6, 41.6, 40.7, 39.7, 38.7, 37.7, 36.8, 35.8, 34.9,
  ]),
});

// 26 CFR 1.401(a)(9)-9(e), Table 4. Probability of death during the year, ages 35–120.
const MORTALITY = [
  0.000823, 0.000819, 0.000824, 0.000836, 0.000853, 0.000879, 0.000909, 0.000945, 0.000980, 0.001019,
  0.001065, 0.001132, 0.001225, 0.001345, 0.001485, 0.001656, 0.001874, 0.002121, 0.002397, 0.002701,
  0.003032, 0.003390, 0.003774, 0.004181, 0.004613, 0.005071, 0.005554, 0.006071, 0.006624, 0.007225,
  0.007884, 0.008238, 0.008659, 0.009163, 0.009767, 0.010491, 0.011358, 0.012385, 0.013598, 0.015014,
  0.016670, 0.018587, 0.020815, 0.023391, 0.026387, 0.029850, 0.033883, 0.038544, 0.043880, 0.049956,
  0.056799, 0.064436, 0.072882, 0.082137, 0.092172, 0.102919, 0.114344, 0.126605, 0.139936, 0.154844,
  0.171902, 0.187210, 0.204659, 0.222921, 0.241884, 0.261476, 0.281536, 0.301847, 0.322371, 0.342940,
  0.361261, 0.372886, 0.381098, 0.383358, 0.385709, 0.388092, 0.390353, 0.392822, 0.395188, 0.397567,
  0.400000, 0.400000, 0.400000, 0.400000, 0.400000, 0.400000,
];

const AFR = [
  4.60, 4.55, // November and December 2025
  4.57, 4.63, 4.72, 4.59, 4.91, 4.97, 5.23, 5.23, 5.40, 5.54, 6.11,
];
const DAY = 86_400_000;

function range(value, min, max, message) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(message);
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) || dateString(date) !== value) {
    throw new RangeError('Enter valid calendar dates.');
  }
  return date;
}

function addMonths(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

export function rateCeiling(firstPayment) {
  const date = parseDate(firstPayment);
  if (date.getUTCFullYear() !== 2026) throw new RangeError('Choose a first payment date in 2026.');
  const month = date.getUTCMonth();
  const months = [month, month + 1].map(index => [
    dateString(new Date(Date.UTC(2025, index + 10, 1))).slice(0, 7), AFR[index],
  ]);
  return { months, maxRate: Math.max(5, ...months.map(([, rate]) => rate)) };
}

export function lifeFactor(age, table) {
  const factor = Object.hasOwn(LIFE, table) && LIFE[table][age - 35];
  if (!Number.isInteger(age) || !factor) throw new RangeError('Choose a supported age and life expectancy table.');
  return factor;
}

export function amortizationFactor(years, ratePct) {
  range(years, Number.MIN_VALUE, 120, 'Enter a valid life expectancy factor.');
  range(ratePct, 0, 100, 'Enter a valid annual interest rate.');
  const rate = ratePct / 100;
  return rate === 0 ? years : -Math.expm1(-years * Math.log1p(rate)) / rate;
}

export function annuityFactor(age, ratePct) {
  if (!Number.isInteger(age) || age < 35 || age > 59) throw new RangeError('Choose a starting age of 35–59.');
  range(ratePct, 0, 100, 'Enter a valid annual interest rate.');
  const discount = 1 + ratePct / 100;
  let discountedSurvival = 1;
  let factor = 0;
  for (const mortality of MORTALITY.slice(age - 35)) {
    discountedSurvival *= (1 - mortality) / discount;
    factor += discountedSurvival;
  }
  // The table levels off at 0.4. Continue that terminal probability for the life annuity.
  const tailRatio = (1 - MORTALITY.at(-1)) / discount;
  return factor + discountedSurvival * tailRatio / (1 - tailRatio);
}

export function payments({ balance, rmdBalance, age, table, rate, maxRate }) {
  range(balance, 0, 1e12, 'Enter a fixed-method balance between $0 and $1 trillion.');
  range(rmdBalance, 0, 1e12, 'Enter an RMD balance between $0 and $1 trillion.');
  range(maxRate, 5, 100, 'Enter a valid interest rate ceiling.');
  range(rate, 0, maxRate, `Choose a rate from 0% to ${maxRate.toFixed(2)}%.`);
  const life = lifeFactor(age, table);
  const amortizationDivisor = amortizationFactor(life, rate);
  const annuityDivisor = annuityFactor(age, rate);
  return {
    life, amortizationDivisor, annuityDivisor,
    rmd: rmdBalance / life,
    amortization: balance / amortizationDivisor,
    annuitization: balance / annuityDivisor,
  };
}

export function minimumBalance(target, divisor) {
  range(target, 0, 1e12, 'Enter a target between $0 and $1 trillion.');
  range(divisor, Number.MIN_VALUE, 120, 'Enter a valid amortization factor.');
  return Math.ceil(target * divisor * 100) / 100;
}

export function lockDates(birth, firstPayment) {
  const birthday = parseDate(birth);
  const first = parseDate(firstPayment);
  const halfBirthday = dateString(addMonths(birthday, 59 * 12 + 6));
  if (firstPayment < birth || firstPayment >= halfBirthday) {
    throw new RangeError('The first payment must be after birth and before age 59½.');
  }
  const anniversary = dateString(addMonths(first, 60));
  return { anniversary, halfBirthday, release: anniversary > halfBirthday ? anniversary : halfBirthday };
}

export function rule55(birth, separation, withdrawal) {
  const birthday = parseDate(birth);
  const exit = parseDate(separation);
  parseDate(withdrawal);
  return exit.getUTCFullYear() >= birthday.getUTCFullYear() + 55 && withdrawal >= separation;
}

function accruedInterest(tax, from, through, quarters, fallback) {
  let date = parseDate(from);
  const end = parseDate(through);
  let logGrowth = 0;
  let projected = false;
  while (date < end && tax > 0) {
    const year = date.getUTCFullYear();
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    const nextQuarter = new Date(Date.UTC(year, quarter * 3, 1));
    const days = (Math.min(+end, +nextQuarter) - +date) / DAY;
    const yearDays = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY;
    const published = quarters[`${year}-Q${quarter}`];
    const rate = published ?? fallback;
    if (rate == null) return { interest: null, projected: false };
    range(rate, 0, 100, 'Enter quarterly interest rates between 0% and 100%.');
    projected ||= published == null;
    logGrowth += days * Math.log1p(rate / 100 / yearDays);
    date = nextQuarter;
  }
  return { interest: tax * Math.expm1(logGrowth), projected };
}

export function recapture({ active, rows, through, quarters = {}, fallback }) {
  if (!active) return { tax: 0, interest: 0, total: 0, projected: false };
  parseDate(through);
  let tax = 0;
  let interest = 0;
  let projected = false;
  for (const row of rows) {
    range(row.amount, 0, 1e12, 'Enter taxable distributions between $0 and $1 trillion.');
    const priorTax = row.amount * 0.10;
    const charge = accruedInterest(priorTax, row.from, through, quarters, fallback);
    tax += priorTax;
    interest = interest === null || charge.interest === null ? null : interest + charge.interest;
    projected ||= charge.projected;
  }
  return { tax, interest, total: interest === null ? null : tax + interest, projected };
}
