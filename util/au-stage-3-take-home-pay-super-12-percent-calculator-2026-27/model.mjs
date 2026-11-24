export const SUPER_RATE = 0.12;
export const SUPER_BASE_CAP = 270830;
export const MEDICARE_THRESHOLD = 28011;
export const MAX_AMOUNT = 1_000_000_000;

const periods = [['Weekly', 52], ['Fortnightly', 26], ['Monthly', 12], ['Annual', 1]];
const maxSuper = SUPER_BASE_CAP * SUPER_RATE;

function cents(value) {
  const scaled = value * 100;
  return Math.round(scaled + Number.EPSILON * Math.abs(scaled)) / 100;
}

export function isAmount(value) {
  return Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT && cents(value) === value;
}

function checkAmount(value, name) {
  if (!isAmount(value)) {
    throw new RangeError(`${name} must be an amount from $0 to $1,000,000,000 with up to two decimal places.`);
  }
}

function grossIncomeTax(income, firstRate) {
  return Math.max(0, Math.min(income, 45000) - 18200) * firstRate
    + Math.max(0, Math.min(income, 135000) - 45000) * 0.30
    + Math.max(0, Math.min(income, 190000) - 135000) * 0.37
    + Math.max(0, income - 190000) * 0.45;
}

export function incomeTax(income, firstRate = 0.15) {
  return cents(grossIncomeTax(income, firstRate));
}

function lito(income) {
  if (income <= 37500) return 700;
  if (income <= 45000) return 700 - (income - 37500) * 0.05;
  return Math.max(0, 325 - (income - 45000) * 0.015);
}

export function lowIncomeTaxOffset(income) {
  return cents(lito(income));
}

export function medicareLevy(income, threshold = MEDICARE_THRESHOLD) {
  return cents(Math.min(income * 0.02, Math.max(0, income - threshold) * 0.10));
}

export function medicareSurcharge(income) {
  if (income >= 164001) return cents(income * 0.015);
  if (income >= 123001) return cents(income * 0.0125);
  if (income >= 105001) return cents(income * 0.01);
  return 0;
}

export function helpRepayment(income) {
  if (income >= 186051) return cents(income * 0.10);
  if (income >= 129718) return cents(9028 + (income - 129717) * 0.17);
  return cents(Math.max(0, income - 69528) * 0.15);
}

export function splitSuper(amount, included = false) {
  checkAmount(amount, included ? 'Package' : 'Salary');
  const gross = included ? cents(Math.max(amount / (1 + SUPER_RATE), amount - maxSuper)) : amount;
  const superPay = included ? cents(amount - gross) : cents(Math.min(gross, SUPER_BASE_CAP) * SUPER_RATE);
  return {gross, superPay, total: cents(gross + superPay)};
}

export function calculatePay({
  amount, included = false, hasHelp = false, applyMls = false,
  deductions = 0, medicareThreshold = MEDICARE_THRESHOLD,
}) {
  checkAmount(deductions, 'Deductions');
  checkAmount(medicareThreshold, 'Medicare threshold');
  const {gross, superPay, total} = splitSuper(amount, included);
  const taxable = cents(Math.max(0, gross - deductions));
  const offset = lito(taxable);
  const tax = cents(Math.max(0, grossIncomeTax(taxable, 0.15) - offset));
  const priorTax = cents(Math.max(0, grossIncomeTax(taxable, 0.16) - offset));
  const medicare = medicareLevy(taxable, medicareThreshold);
  const mls = applyMls ? medicareSurcharge(taxable) : 0;
  const help = hasHelp ? helpRepayment(taxable) : 0;
  const net = cents(gross - tax - medicare - mls - help);
  const annual = {gross, tax, medicare, mls, help, superPay, net, savings: cents(priorTax - tax)};
  const cycles = periods.map(([period, divisor]) => ({
    period,
    ...Object.fromEntries(Object.entries(annual).map(([key, value]) => [key, cents(value / divisor)])),
  }));
  return {annual, cycles, taxable, total};
}
