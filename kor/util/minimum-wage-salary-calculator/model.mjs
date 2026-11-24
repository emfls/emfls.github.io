const floor = Math.floor;

function integer(value, max = 12_000_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError('금액을 허용 범위의 정수로 입력하세요.');
  }
  return value;
}

export function minimumWage(year) {
  if (year !== 2026 && year !== 2027) throw new RangeError('2026년 또는 2027년을 선택하세요.');
  const hourly = year === 2027 ? 10700 : 10320;
  return {hourly, daily: hourly * 8, monthly: hourly * 209};
}

function hundredths(hours) {
  const result = Math.round(hours * 100);
  if (typeof hours !== 'number' || result / 100 !== hours) {
    throw new RangeError('주 소정근로시간을 소수 둘째 자리까지 입력하세요.');
  }
  return integer(result, 16800);
}

export function weeklyHolidayPay(hourly, hours, attended) {
  integer(hourly, 1000000);
  const units = hundredths(hours);
  return attended && units >= 1500 ? floor(Math.min(units, 4000) * hourly / 500) : 0;
}

export function longTermCare(health, year = 2027) {
  integer(health);
  minimumWage(year);
  return floor(health * (year === 2027 ? 1390 : 1314) / 10000);
}

function estimatedIncomeTax(taxable, contributions) {
  const annual = taxable * 12;
  let lower = 0;
  let deduction = 0;
  for (const [upper, percent] of [
    [5000000, 70], [15000000, 40], [45000000, 15], [100000000, 5], [Infinity, 2],
  ]) {
    if (annual <= lower) break;
    deduction += floor((Math.min(annual, upper) - lower) * percent / 100);
    lower = upper;
  }
  const base = Math.max(0, annual - Math.min(20000000, deduction) - 1500000 - contributions * 12);
  const [percent, offset] = [
    [14000000, 6, 0], [50000000, 15, 1260000], [88000000, 24, 5760000],
    [150000000, 35, 15440000], [300000000, 38, 19940000], [500000000, 40, 25940000],
    [1000000000, 42, 35940000], [Infinity, 45, 65940000],
  ].find(([upper]) => base <= upper).slice(1);
  const assessed = floor((base * percent - offset * 100) / 100);
  const earned = floor((Math.min(assessed, 1300000) * 55 + Math.max(0, assessed - 1300000) * 30) / 100);
  const cap = annual <= 33000000 ? 740000
    : annual <= 70000000 ? Math.max(660000, floor((740000000 - (annual - 33000000) * 8) / 1000))
    : annual <= 120000000 ? Math.max(500000, floor((1320000 - (annual - 70000000)) / 2))
    : Math.max(200000, floor((1000000 - (annual - 120000000)) / 2));
  // shortcut: single-worker annualized proxy, replace once the applicable withholding table is available.
  return floor(Math.max(0, assessed - Math.min(earned, cap) - 130000) / 12);
}

export function salaryPay({salary, annual = false, meal = 200000, insured = true, incomeTax}) {
  integer(salary, annual ? 12000000000 : 1000000000);
  integer(meal, 200000);
  const gross = annual ? floor(salary / 12) : salary;
  const taxable = gross - Math.min(gross, meal);
  const enrolled = taxable > 0 && insured;
  // 2027 January–June standard monthly income band, rounded down to KRW 1,000.
  const pensionBase = Math.max(410000, Math.min(6590000, floor(taxable / 1000) * 1000));
  const pension = enrolled ? floor(pensionBase * 5 / 100) : 0;
  const health = enrolled ? floor(taxable * 3595 / 100000) : 0;
  const care = longTermCare(health);
  const employment = enrolled ? floor(taxable * 9 / 1000) : 0;
  const contributions = pension + health + care + employment;
  const national = incomeTax === undefined ? estimatedIncomeTax(taxable, contributions) : integer(incomeTax, gross);
  const localTax = floor(national / 10);
  return {gross, taxable, insurance: {pension, health, care, employment},
    incomeTax: national, localTax, net: gross - contributions - national - localTax};
}

export function hourlyPay({hourly, hours, attended = true, insured = true, incomeTax}) {
  const holiday = weeklyHolidayPay(hourly, hours, attended);
  const units = hundredths(hours);
  const paidHours = Math.min(units, 4000);
  const holidayHours = attended && units >= 1500 ? paidHours : 0;
  const salary = paidHours === 4000 && attended
    ? hourly * 209
    : floor(hourly * (5 * paidHours + holidayHours) * 365 / 42000);
  return {...salaryPay({salary, meal: 0, insured, incomeTax}), holiday};
}
