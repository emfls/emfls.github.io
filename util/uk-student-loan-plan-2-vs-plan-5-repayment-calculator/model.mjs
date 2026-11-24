const MAX_CENTS = 1_000_000_000;
const roundRatio = (n, d) => Math.floor((n + d / 2) / d);

export function checkInteger(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' is outside the supported range.');
  }
  return value;
}

export function parseCents(value) {
  const match = /^([+-]?)([0-9]{1,9})(?:[.]([0-9]{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new RangeError('Enter a number with up to two decimal places.');
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return checkInteger(match[1] === '-' && cents ? -cents : cents, -MAX_CENTS, MAX_CENTS, 'Amount');
}

const PLANS = {
  2: {threshold: 2938500, upper: 5288500, term: 30, monthly: 244875, weekly: 56509},
  5: {threshold: 2500000, term: 40, monthly: 208333, weekly: 48076},
};
export const PLAN_2_CAP_BPS = 600;
export const DEFAULT_RPI_BPS = 410;
const NI_UPPER = 5027000;
const NI_LOWER = 1257000;
const ADDITIONAL_TAX_START = 12514000;
const ALLOWANCE_TAPER_START = 10000000;

function planFor(plan) {
  if (!Object.hasOwn(PLANS, plan)) throw new RangeError('Choose Plan 2 or Plan 5.');
  return PLANS[plan];
}

export function planRules(plan) {
  return {...planFor(plan)};
}

export function annualRepayment(salary, threshold) {
  checkInteger(salary, 0, MAX_CENTS * 50, 'Salary');
  checkInteger(threshold, 0, MAX_CENTS * 50, 'Repayment threshold');
  return roundRatio(Math.max(0, salary - threshold) * 9, 100);
}

export function interestBps(plan, salary, rpiBps, cap = true, threshold = planFor(plan).threshold,
  upper = planFor(plan).upper) {
  planFor(plan);
  checkInteger(salary, 0, MAX_CENTS * 50, 'Salary');
  checkInteger(rpiBps, 0, 1500, 'RPI');
  if (plan === 5 || plan === '5') return rpiBps;
  const span = upper - threshold;
  const excess = Math.max(0, Math.min(salary - threshold, span));
  const rate = rpiBps + roundRatio(excess * 300, span);
  return cap ? Math.min(rate, PLAN_2_CAP_BPS) : rate;
}

export function graduateMarginalRate(salary, plan, owesLoan = true) {
  checkInteger(salary, 0, MAX_CENTS, 'Salary');
  const {threshold} = planFor(plan);
  // Income-only scenario with the standard Personal Allowance and category A NI.
  const tax = salary >= ADDITIONAL_TAX_START ? 45 : salary >= ALLOWANCE_TAPER_START ? 60
    : salary >= NI_UPPER ? 40 : salary >= NI_LOWER ? 20 : 0;
  const ni = salary >= NI_UPPER ? 2 : salary >= NI_LOWER ? 8 : 0;
  return tax + ni + (owesLoan && salary >= threshold ? 9 : 0);
}

export function simulatePlan({
  plan, balance, salary, salaryGrowthBps, thresholdGrowthBps,
  rpiBps = DEFAULT_RPI_BPS, cap = true, yearsRemaining = planFor(plan).term,
}) {
  const rules = planFor(plan);
  checkInteger(balance, 0, MAX_CENTS, 'Starting balance');
  checkInteger(salary, 0, MAX_CENTS, 'Salary');
  checkInteger(salaryGrowthBps, -500, 1000, 'Salary growth');
  checkInteger(thresholdGrowthBps, -500, 1000, 'Threshold growth');
  checkInteger(yearsRemaining, 0, rules.term, 'Years to write-off');
  checkInteger(rpiBps, 0, 1500, 'RPI');
  const plan2 = Number(plan) === 2;
  let {threshold, upper} = rules;
  const scheduledAnnual = annualRepayment(salary, threshold);
  const yearOneRate = interestBps(plan, salary, rpiBps, cap);
  const marginalRate = graduateMarginalRate(salary, plan, balance > 0 && yearsRemaining > 0);
  const rows = [];
  let totalPaid = 0;
  for (let i = 0; i < yearsRemaining && balance > 0; i++) {
    const year = 2026 + i;
    const rate = interestBps(plan, salary, rpiBps, cap && i === 0, threshold, upper);
    const interest = roundRatio(balance * rate, 10000);
    const paid = Math.min(balance + interest, annualRepayment(salary, threshold));
    balance += interest - paid;
    totalPaid += paid;
    rows.push({year, salary, threshold, rate, interest, paid, balance});
    salary = roundRatio(salary * (10000 + salaryGrowthBps), 10000);
    if (!plan2 && year === 2026) {
      threshold = 2602500;
    } else if (!plan2 || year >= 2029) {
      threshold = roundRatio(threshold * (10000 + thresholdGrowthBps), 10000);
      if (plan2) upper = roundRatio(upper * (10000 + thresholdGrowthBps), 10000);
    }
  }
  return {
    scheduledAnnual, scheduledMonthly: roundRatio(scheduledAnnual, 12),
    actualYearOnePaid: rows[0]?.paid ?? 0, yearOneRate, marginalRate,
    totalPaid, writtenOff: balance, cleared: balance === 0, rows,
  };
}
