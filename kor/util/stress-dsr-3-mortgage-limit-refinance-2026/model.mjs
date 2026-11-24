export const RATE_TYPES = Object.freeze({
  variable: '변동형',
  mixed: '5년 혼합형',
  periodic: '5년 주기형',
  fixed: '전 기간 고정형',
});

export const STRESS_POLICIES = Object.freeze({
  regional: Object.freeze({ baseRate: 1.5, baseFactor: 0.5, mixed: 0.6, periodic: 0.3 }),
  metro: Object.freeze({ baseRate: 3, baseFactor: 1, mixed: 0.8, periodic: 0.4 }),
  scenario: Object.freeze({ baseRate: 3, baseFactor: 1, mixed: 0.6, periodic: 0.3 }),
});

function checkNumber(value, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError('입력값이 계산 범위를 벗어났습니다.');
  }
}

// Rates are annual percentage points. Money stays in the caller's unit.
export function annuityFactor(annualRate, months) {
  checkNumber(annualRate, 0, 100);
  checkNumber(months, 1, 600, true);
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return months;
  return -Math.expm1(-months * Math.log1p(monthlyRate)) / monthlyRate;
}

export function mortgageLimit({ income, dsr, annualDebt, rate, years, policy, stressRate, type }) {
  checkNumber(income, 0, 1e9);
  checkNumber(annualDebt, 0, 1e9);
  checkNumber(rate, 0, 30);
  if (![40, 50].includes(dsr) || ![30, 40].includes(years) ||
      !Object.hasOwn(STRESS_POLICIES, policy) || !Object.hasOwn(RATE_TYPES, type) ||
      (policy === 'metro' && years === 40)) {
    throw new RangeError('DSR 심사 조건을 확인해 주세요.');
  }

  const rules = STRESS_POLICIES[policy];
  const baseRate = policy === 'scenario' ? stressRate : rules.baseRate;
  checkNumber(baseRate, 0, 10);
  const annualBudget = Math.max(0, income * (dsr / 100) - annualDebt);
  const months = years * 12;
  const unstressed = (annualBudget / 12) * annuityFactor(rate, months);

  // For a five-year period and a 30- or 40-year maturity, the ratio is below 30%.
  const factors = { variable: 1, mixed: rules.mixed, periodic: rules.periodic, fixed: 0 };
  const comparisons = Object.entries(factors).map(([key, factor]) => {
    const addedRate = baseRate * rules.baseFactor * factor;
    const screeningRate = rate + addedRate;
    const limit = (annualBudget / 12) * annuityFactor(screeningRate, months);
    return { type: key, factor, addedRate, screeningRate, limit };
  });
  const selected = comparisons.find(item => item.type === type);
  return { annualBudget, unstressed, selected, reduction: unstressed - selected.limit, comparisons };
}

function cumulativeInterest(principal, rate, payment, months) {
  const monthlyRate = rate / 1200;
  let balance = principal;
  let total = 0;
  const interest = [0];
  for (let month = 1; month <= months; month += 1) {
    const charge = balance * monthlyRate;
    total += charge;
    interest.push(total);
    balance = Math.max(0, balance + charge - payment);
  }
  return interest;
}

export function refinance({ principal, oldRate, newRate, months, elapsedMonths, oldFeeRate, newFeeRate, expenses }) {
  checkNumber(principal, 0, 1e9);
  checkNumber(oldRate, 0, 30);
  checkNumber(newRate, 0, 30);
  checkNumber(months, 1, 600, true);
  checkNumber(elapsedMonths, 0, 600);
  checkNumber(oldFeeRate, 0, 10);
  checkNumber(newFeeRate, 0, 10);
  checkNumber(expenses, 0, 1e9);

  const oldPayment = principal / annuityFactor(oldRate, months);
  const newPayment = principal / annuityFactor(newRate, months);
  const monthlySavings = oldPayment - newPayment;
  const oldInterest = cumulativeInterest(principal, oldRate, oldPayment, months);
  const newInterest = cumulativeInterest(principal, newRate, newPayment, months);
  const remainingFeeFraction = Math.max(0, (36 - elapsedMonths) / 36);
  const horizon = Math.min(60, months);
  const scenarios = [oldFeeRate, newFeeRate].map(rate => {
    const fee = principal * (rate / 100) * remainingFeeFraction;
    const upfront = fee + expenses;
    const net = oldInterest.map((value, month) => value - newInterest[month] - upfront);
    const interestMonth = net.findIndex(value => value >= 0);
    const cashMonth = monthlySavings > 0 ? Math.ceil(upfront / monthlySavings) : null;
    const breakEven = net[months] >= 0 && interestMonth >= 0 ? interestMonth : null;
    const cashBreakEven = upfront === 0 && monthlySavings >= 0 ? 0
      : cashMonth !== null && cashMonth <= months ? cashMonth : null;
    return { fee, upfront, breakEven, cashBreakEven, net, fiveYear: net[horizon], maturity: net[months] };
  });

  return { oldPayment, newPayment, monthlySavings, horizon, scenarios };
}
