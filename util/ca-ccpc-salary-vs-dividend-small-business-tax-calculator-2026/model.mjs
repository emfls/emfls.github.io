export const BUSINESS_LIMIT = 500000;
export const MAX_PROFIT = 2000000;
export const CPP_SECOND_CEILING = 85000;
export const RRSP_2026_LIMIT = 33810;
export const RRSP_2027_LIMIT = 35390;
export const RRSP_SALARY_TARGET = Math.ceil(RRSP_2027_LIMIT / 0.18);

const firstCeiling = 74600;
const exemption = 3500;
const federalBrackets = [[0, .14], [58523, .205], [117045, .26], [181440, .29], [258482, .33]];
const provinces = {
  ON: {
    small: .032, general: .115, dtc: .029863, basic: 12989,
    brackets: [[0, .0505], [53891, .0915], [107785, .1116], [150000, .1216], [220000, .1316]],
  },
  BC: {
    small: .02, general: .12, dtc: .0196, basic: 13216,
    brackets: [[0, .056], [50363, .077], [100728, .105], [115648, .1229], [140430, .147], [190405, .168], [265545, .205]],
  },
  AB: {
    small: .02, general: .08, dtc: .0218, basic: 22769,
    brackets: [[0, .08], [61200, .10], [154259, .12], [185111, .13], [246813, .14], [370220, .15]],
  },
  QC: {
    small: .032, general: .115, dtc: .0342, basic: 18952,
    brackets: [[0, .14], [54345, .19], [108680, .24], [132245, .2575]],
  },
};

const positive = value => Math.max(0, value);
const cents = value => Math.round((value + Number.EPSILON) * 100);
const money = value => cents(value) / 100;

function provinceRules(province) {
  if (!Object.hasOwn(provinces, province)) throw new RangeError('Select a supported province.');
  return provinces[province];
}

function checkAmount(value, ceiling, label) {
  if (!Number.isFinite(value) || value < 0 || value > ceiling) {
    throw new RangeError(`${label} must be between 0 and ${ceiling.toLocaleString('en-CA')}.`);
  }
}

function dateDay(isoDate) {
  const date = new Date(isoDate);
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)
      || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) {
    throw new RangeError('Enter valid corporate tax-year dates.');
  }
  return date.getTime() / 86400000;
}

export function corporateRates(province, start = '2026-01-01', end = '2026-12-31') {
  const rules = provinceRules(province);
  const first = dateDay(start);
  const last = dateDay(end);
  const days = last - first + 1;
  if (!end.startsWith('2026-') || days < 1 || days > 371) {
    throw new RangeError('Use a corporate tax year of up to 53 weeks ending in 2026.');
  }

  let provincialSmall = rules.small;
  if (province === 'ON') {
    const newRateDays = positive(last - Math.max(first, dateDay('2026-07-01')) + 1);
    provincialSmall -= .01 * newRateDays / days;
  } else if (province === 'QC' && start > '2026-04-29') {
    provincialSmall = .022;
  }
  return { small: .09 + provincialSmall, general: .15 + rules.general, provincialSmall, provincialGeneral: rules.general };
}

function corporateTaxAtRates(profit, rates, federalLimit, provincialLimit) {
  const federalSlice = Math.min(profit, federalLimit);
  const provincialSlice = Math.min(profit, provincialLimit);
  return money(federalSlice * .09 + (profit - federalSlice) * .15)
    + money(provincialSlice * rates.provincialSmall + (profit - provincialSlice) * rates.provincialGeneral);
}

export function corporateTax(profit, province, {
  federalLimit = BUSINESS_LIMIT, provincialLimit = federalLimit, start, end,
} = {}) {
  checkAmount(profit, MAX_PROFIT, 'Corporate profit');
  checkAmount(federalLimit, BUSINESS_LIMIT, 'Federal business limit');
  checkAmount(provincialLimit, BUSINESS_LIMIT, 'Provincial business limit');
  return money(corporateTaxAtRates(profit, corporateRates(province, start, end), federalLimit, provincialLimit));
}

export function payroll(salary, province) {
  const isQuebec = province === 'QC';
  const band1 = positive(Math.min(salary, firstCeiling) - exemption);
  const band2 = positive(Math.min(salary, CPP_SECOND_CEILING) - firstCeiling);
  const tier1 = money(band1 * (isQuebec ? .063 : .0595));
  const tier2 = money(band2 * .04);
  const pensionSide = money(tier1 + tier2);
  const enhanced = money(band1 * .01 + tier2);
  const insurablePay = isQuebec ? Math.min(salary, 103000) : 0;
  const employeeQpip = salary >= 2000 ? money(insurablePay * .0043) : 0;
  const employerQpip = money(insurablePay * .00602);

  return {
    tier1, tier2, enhanced, base: money(pensionSide - enhanced),
    employeeQpip, employerQpip, pensionTotal: money(pensionSide * 2),
    employee: money(pensionSide + employeeQpip), employer: money(pensionSide + employerQpip),
  };
}

export function maxAffordableSalary(profit, province) {
  let low = 0;
  let high = cents(profit);
  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    const cost = candidate + cents(payroll(candidate / 100, province).employer);
    if (cost <= cents(profit)) low = candidate;
    else high = candidate - 1;
  }
  return low / 100;
}

export function rrspRoom(salary) {
  return money(Math.min(positive(salary) * .18, RRSP_2027_LIMIT));
}

function bracketTax(income, brackets) {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [floor, rate] = brackets[i];
    if (income <= floor) break;
    const ceiling = brackets[i + 1]?.[0] ?? Infinity;
    tax += (Math.min(income, ceiling) - floor) * rate;
  }
  return tax;
}

function ontarioHealthPremium(income) {
  return Math.min(300, positive(income - 20000) * .06)
    + Math.min(150, positive(income - 36000) * .06)
    + Math.min(150, positive(income - 48000) * .25)
    + Math.min(150, positive(income - 72000) * .25)
    + Math.min(150, positive(income - 200000) * .25);
}

export function personalTax(salary, dividend, province) {
  const rules = provinceRules(province);
  const contributions = payroll(salary, province);
  const taxableDividend = money(dividend * 1.15);
  const federalIncome = positive(salary + taxableDividend - contributions.enhanced);
  const federalBasic = 16452 - Math.min(1623, positive(federalIncome - 181440) * 1623 / 77042);
  const federalCredits = (federalBasic + Math.min(salary, 1501) + contributions.base + contributions.employeeQpip) * .14;
  const federalDtc = taxableDividend * .090301;
  const federalBeforeAbatement = positive(bracketTax(federalIncome, federalBrackets) - federalCredits - federalDtc);
  const isQuebec = province === 'QC';
  const federal = money(federalBeforeAbatement * (isQuebec ? .835 : 1));

  const provincialIncome = isQuebec ? positive(federalIncome - Math.min(salary * .06, 1450)) : federalIncome;
  const provincialCredits = (rules.basic + (isQuebec ? 0 : contributions.base)) * rules.brackets[0][1];
  const provincialDtc = taxableDividend * rules.dtc;
  const basicTax = positive(bracketTax(provincialIncome, rules.brackets) - provincialCredits);
  let provincial = basicTax - provincialDtc;
  let healthPremium = 0;

  if (province === 'ON') {
    const surtax = positive(basicTax - 5818) * .20 + positive(basicTax - 7446) * .36;
    provincial = positive(basicTax + surtax - provincialDtc);
    provincial -= Math.min(provincial, positive(600 - provincial));
    healthPremium = money(ontarioHealthPremium(provincialIncome));
  } else if (province === 'BC') {
    provincial -= positive(690 - positive(provincialIncome - 25570) * .0356);
  }
  provincial = money(positive(provincial));

  return { federal, provincial, healthPremium, total: money(federal + provincial + healthPremium), taxableDividend };
}

function scenario(profit, salary, retainRate, province, rates, federalLimit, provincialLimit) {
  const contributions = payroll(salary, province);
  const abi = money(positive(profit - salary - contributions.employer));
  const corpTax = money(corporateTaxAtRates(abi, rates, federalLimit, provincialLimit));
  const available = money(abi - corpTax);
  const retained = money(available * retainRate);
  const dividend = money(available - retained);
  const tax = personalTax(salary, dividend, province);
  const qpip = money(contributions.employeeQpip + contributions.employerQpip);
  return {
    salary, dividend, retained, abi, corpTax, personalTax: tax.total, taxableDividend: tax.taxableDividend,
    pension: contributions.pensionTotal, employeePension: money(contributions.employee - contributions.employeeQpip),
    employerPension: money(contributions.employer - contributions.employerQpip), qpip,
    totalBurden: money(corpTax + tax.total + contributions.pensionTotal + qpip),
    netCash: money(salary + dividend - tax.total - contributions.employee),
    rrspRoom: rrspRoom(salary),
  };
}

export function calculateStrategies({
  province, profit, retainRate = 0, goal = 'cash',
  federalLimit = BUSINESS_LIMIT, provincialLimit = federalLimit, start, end,
}) {
  checkAmount(profit, MAX_PROFIT, 'Profit');
  checkAmount(federalLimit, BUSINESS_LIMIT, 'Federal business limit');
  checkAmount(provincialLimit, BUSINESS_LIMIT, 'Provincial business limit');
  checkAmount(retainRate, 1, 'Retention fraction');
  const goals = { cash: 0, pension: CPP_SECOND_CEILING, rrsp: RRSP_SALARY_TARGET };
  if (!Object.hasOwn(goals, goal)) throw new RangeError('Select a supported salary goal.');

  profit = money(profit);
  const rates = corporateRates(province, start, end);
  const cap = maxAffordableSalary(profit, province);
  const target = Math.min(cap, goals[goal]);
  const compare = (salary, retention) => scenario(profit, salary, retention, province, rates, federalLimit, provincialLimit);
  const salary = compare(cap, 1);
  const dividend = compare(0, 0);
  let hybrid = compare(target, retainRate);

  function consider(candidate) {
    if (candidate < 0 || candidate > cap) return;
    const result = compare(candidate, retainRate);
    if (result.netCash > hybrid.netCash || (result.netCash === hybrid.netCash && result.salary < hybrid.salary)) {
      hybrid = result;
    }
  }

  if (goal === 'cash') {
    // Test round salaries and payroll/SBD boundaries, then refine near the best result.
    for (let candidate = 0; candidate <= cap; candidate += 100) consider(candidate);
    for (const candidate of [cap, 1999.99, 2000, exemption, firstCeiling, CPP_SECOND_CEILING, 103000, RRSP_SALARY_TARGET,
      maxAffordableSalary(positive(profit - federalLimit), province),
      maxAffordableSalary(positive(profit - provincialLimit), province)]) {
      consider(candidate);
    }
    const coarseBest = hybrid.salary;
    for (let candidate = Math.max(0, Math.ceil(coarseBest - 100)); candidate <= Math.min(cap, coarseBest + 100); candidate++) {
      consider(candidate);
    }
  }
  return {
    rates, salary: { ...salary, deferredTax: 0 }, dividend: { ...dividend, deferredTax: 0 },
    hybrid: {
      ...hybrid,
      deferredTax: money(positive(personalTax(hybrid.salary, money(hybrid.dividend + hybrid.retained), province).total - hybrid.personalTax)),
    },
    salaryTarget: goals[goal], salaryTargetAffordable: cap >= goals[goal],
  };
}
