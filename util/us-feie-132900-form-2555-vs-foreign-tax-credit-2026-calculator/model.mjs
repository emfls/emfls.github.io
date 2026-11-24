export const FEIE_MAX = 132_900;
export const HOUSING_BASE = 21_264;
export const HOUSING_CAP = 39_870;

const schedules = {
  single: {
    deduction: 16_100, ctcThreshold: 200_000, rothStart: 153_000, rothEnd: 168_000,
    ceilings: [12_400, 50_400, 105_700, 201_775, 256_225, 640_600, Infinity],
  },
  joint: {
    deduction: 32_200, ctcThreshold: 400_000, rothStart: 242_000, rothEnd: 252_000,
    ceilings: [24_800, 100_800, 211_400, 403_550, 512_450, 768_700, Infinity],
  },
};
const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];

function schedule(status) {
  if (status !== 'single' && status !== 'joint') throw new RangeError('Select a supported filing status.');
  return schedules[status];
}

function amount(value, label, max = 100_000_000, whole = false) {
  if (!Number.isFinite(value) || value < 0 || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number' : 'a number'} between 0 and ${max.toLocaleString('en-US')}.`);
  }
  return value;
}

export function federalTax(taxableIncome, status) {
  const { ceilings } = schedule(status);
  return ceilings.reduce((tax, ceiling, i) => {
    const lower = i === 0 ? 0 : ceilings[i - 1];
    return tax + Math.max(0, Math.min(taxableIncome, ceiling) - lower) * rates[i];
  }, 0);
}

export function exclusionForPerson({
  foreignWages = 0, qualifyingWages = foreignWages, test = 'none',
  presenceDays = 0, qualifyingDays = 0, housingExpenses = 0, cityCap = HOUSING_CAP,
} = {}) {
  amount(foreignWages, 'Foreign wages');
  amount(qualifyingWages, 'Foreign wages earned during the qualifying period', foreignWages);
  amount(presenceDays, 'Full days abroad in the 12-month window', 366, true);
  amount(qualifyingDays, 'Qualifying-period days in 2026', 365, true);
  amount(housingExpenses, 'Qualified housing expenses');
  amount(cityCap, 'Annual housing expense cap');
  if (!['none', 'physical', 'residence'].includes(test)) throw new RangeError('Select a supported Form 2555 test.');

  const eligible = qualifyingDays > 0 && (test === 'residence' || (test === 'physical' && presenceDays >= 330));
  const days = eligible ? qualifyingDays : 0;
  const feieLimit = FEIE_MAX * days / 365;
  // Form 2555 uses published daily rates for partial years and annual amounts for 365 days.
  const housingBase = days === 365 ? HOUSING_BASE : 58.26 * days;
  const housingLimit = days === 365 ? cityCap : Math.round(cityCap / 365 * 100) / 100 * days;
  const housingExclusion = Math.min(qualifyingWages, Math.max(0, Math.min(housingExpenses, housingLimit) - housingBase));
  const feie = Math.min(feieLimit, qualifyingWages - housingExclusion);
  return { eligible, days, feieLimit, housingBase, housingLimit, housingExclusion, feie, total: feie + housingExclusion };
}

function rothRoom(compensation, magi, people, rules) {
  const available = people.map(person => {
    if (magi >= rules.rothEnd || compensation === 0) return 0;
    const regularLimit = Math.min(compensation, person.age50 ? 8_600 : 7_500);
    const reduction = Math.max(0, (magi - rules.rothStart) / (rules.rothEnd - rules.rothStart));
    const phasedLimit = reduction === 0 ? regularLimit
      : Math.max(200, Math.ceil((regularLimit * (1 - reduction) - 1e-9) / 10) * 10);
    const other = person.otherIra ?? 0;
    return Math.max(0, Math.min(regularLimit - other, phasedLimit, compensation));
  });
  const remainingCompensation = Math.max(0, compensation - people.reduce((sum, person) => sum + (person.otherIra ?? 0), 0));
  const limits = available.map(value => Math.min(value, remainingCompensation));
  return { magi, compensation, limits, combined: Math.min(remainingCompensation, limits.reduce((sum, value) => sum + value, 0)) };
}

export function compare({
  status = 'single', taxpayer = {}, spouse = {}, usWages = 0, otherIncome = 0,
  foreignTax = 0, children = 0, payrollActc = 0,
} = {}) {
  const rules = schedule(status);
  const people = status === 'joint' ? [taxpayer, spouse] : [taxpayer];
  const exclusions = people.map(exclusionForPerson);
  for (const person of people) amount(person.otherIra ?? 0, 'Other IRA contributions');
  amount(usWages, 'U.S. wages');
  amount(otherIncome, 'Other U.S. ordinary income');
  amount(foreignTax, 'Creditable foreign income tax');
  amount(children, 'Qualifying children', 100, true);
  amount(payrollActc, 'Schedule 8812 net payroll amount');
  const foreignWages = people.reduce((sum, person) => sum + (person.foreignWages ?? 0), 0);
  if (foreignTax > 0 && foreignWages === 0) throw new RangeError('Enter foreign wages for the foreign income tax.');
  const excluded = exclusions.reduce((sum, person) => sum + person.total, 0);
  const wages = foreignWages + usWages;
  const grossIncome = wages + otherIncome;
  const ctcAvailable = Math.max(0, children * 2_200 - Math.ceil(Math.max(0, grossIncome - rules.ctcThreshold) / 1_000) * 50);
  const eligible2555 = exclusions.some(person => person.eligible) && excluded > 0;

  function scenario(exclusion, filed2555) {
    const taxableIncome = Math.max(0, grossIncome - exclusion - rules.deduction);
    const incomeTax = federalTax(taxableIncome + exclusion, status) - federalTax(exclusion, status);
    // Form 1116 allocates the standard deduction using gross income before the exclusions.
    const foreignDeduction = grossIncome ? rules.deduction * foreignWages / grossIncome : 0;
    const foreignTaxable = Math.max(0, foreignWages - exclusion - foreignDeduction);
    const ftcLimit = taxableIncome ? incomeTax * Math.min(1, foreignTaxable / taxableIncome) : 0;
    const disallowedTax = foreignWages ? foreignTax * exclusion / foreignWages : 0;
    const creditableTax = foreignTax - disallowedTax;
    const ftc = Math.min(creditableTax, ftcLimit);
    const afterFtc = Math.max(0, incomeTax - ftc);
    const childCredit = Math.min(afterFtc, ctcAvailable);
    const earnedIncomeRefund = Math.max(0, wages - 2_500) * 0.15;
    const refundBase = children >= 3 ? Math.max(earnedIncomeRefund, payrollActc) : earnedIncomeRefund;
    const actc = filed2555 ? 0 : Math.min(ctcAvailable - childCredit, children * 1_700, refundBase);
    const netTax = afterFtc - childCredit - actc;

    return {
      taxableIncome, incomeTax, foreignTaxable, ftcLimit, disallowedTax, ftc,
      excessFtc: creditableTax - ftc, childCredit, actc, netTax,
      roth: rothRoom(wages - exclusion, grossIncome, people, rules),
    };
  }

  const feie = eligible2555 ? scenario(excluded, true) : null;
  const ftc = scenario(0, false);
  return {
    exclusions, excluded, deduction: rules.deduction, ctcAvailable, feie, ftc,
    difference: feie ? feie.netTax - ftc.netTax : null,
  };
}
