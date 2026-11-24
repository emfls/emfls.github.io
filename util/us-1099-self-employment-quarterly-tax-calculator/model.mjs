export const DUE_DATES = Object.freeze(['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15']);
const WAGE_BASE = 18_450_000;

export function selfEmployment(profit, socialSecurityWages, medicareWages, status) {
  const {medicareThreshold} = filingRules(status);
  const earnings = rate(Math.max(0, profit), 9235);
  const subject = profit * 9235 >= 40_000 * 10000 ? earnings : 0;
  const socialSecurity = rate(Math.min(subject, Math.max(0, WAGE_BASE - socialSecurityWages)), 1240);
  const medicare = rate(subject, 290);
  const remaining = Math.max(0, medicareThreshold - medicareWages);
  const additionalSe = rate(Math.max(0, subject - remaining), 90);
  const additionalWages = rate(Math.max(0, medicareWages - medicareThreshold), 90);
  const seTax = socialSecurity + medicare;
  return {earnings, socialSecurity, medicare, additionalSe, additionalWages, seTax,
    seWithAdditional: seTax + additionalSe,
    deduction: rounded(seTax, 2)};
}

export function qualifiedDeduction({income, qbi, status, sstb, active, payroll, property}) {
  const {qbiThreshold, qbiRange} = filingRules(status);
  const phased = Math.min(qbiRange, Math.max(0, income - qbiThreshold));
  const included = sstb ? qbiRange - phased : qbiRange;
  // Keep the two phase-in ratios exact until the final cent.
  const range = BigInt(qbiRange);
  const full = BigInt(qbi) * 2000n;
  const wageLimit = BigInt(Math.max(payroll * 5000, payroll * 2500 + property * 250));
  const excess = full > wageLimit ? full - wageLimit : 0n;
  const numerator = (full * range - excess * BigInt(phased)) * BigInt(included);
  const denominator = 10000n * range * range;
  const business = Number((numerator + denominator / 2n) / denominator);
  const minimum = active && BigInt(qbi) * BigInt(included) >= 100_000n * range ? 40_000 : 0;
  return Math.max(minimum, Math.min(rate(income, 2000), business));
}

export function estimate(input) {
  const {gross, expenses, wages, socialSecurityWages, medicareWages, status,
    withholding, payroll, property, sstb, active} = input;
  const {standard} = filingRules(status);
  const profit = gross - expenses;
  const se = selfEmployment(profit, socialSecurityWages, medicareWages, status);
  const income = Math.max(0, wages + profit - se.deduction - standard);
  const qbi = qualifiedDeduction({income, qbi: Math.max(0, profit - se.deduction), status,
    sstb, active, payroll, property});
  const taxable = Math.max(0, income - qbi);
  const federal = ordinaryTax(taxable, status);
  const total = federal + se.seWithAdditional + se.additionalWages;
  const effective = wages + profit > 0 ? rounded(total * 10000, wages + profit) : null;
  const target = total - withholding >= 100_000 ? Math.max(0, rate(total, 9000) - withholding) : 0;
  const installments = DUE_DATES.map((_, index) =>
    Math.floor(target / 4) + Number(index < target % 4));
  return {...se, profit, standard, income, qbi, taxable, federal, total, effective, target, installments};
}

export function calculate(input) {
  const wages = cents(input.wages, 'Box 1 wages');
  if (input.status === 'mfj' && wages && !input.socialSecurityWages?.trim()) {
    throw new RangeError('For joint wages, enter the business owner’s Box 3 wages or 0 under W-2, withholding and QBI.');
  }
  const result = estimate({
    gross: cents(input.gross, '1099 business receipts'),
    expenses: cents(input.expenses, 'business expenses'),
    wages,
    socialSecurityWages: input.socialSecurityWages?.trim()
      ? cents(input.socialSecurityWages, 'the business owner’s Box 3 wages') : Math.min(wages, WAGE_BASE),
    medicareWages: input.medicareWages?.trim() ? cents(input.medicareWages, 'Box 5 wages') : wages,
    status: input.status,
    sstb: input.business === 'sstb',
    active: input.active === 'yes',
    withholding: cents(input.withholding, 'federal withholding'),
    payroll: cents(input.payroll, 'eligible business W-2 payroll'),
    property: cents(input.property, 'qualified property basis')
  });
  const {effective, installments, ...amounts} = result;
  return {...formatMoney(amounts), effective: effective === null ? '—' : (effective / 100).toFixed(2) + '%',
    ...Object.fromEntries(installments.map((amount, index) => ['payment' + (index + 1), currency.format(amount / 100)]))};
}

const RATES = [10, 12, 22, 24, 32, 35, 37];
const FILINGS = {
  single: [16_100, 200_000, 201_750, 75_000, [12_400, 50_400, 105_700, 201_775, 256_225, 640_600]],
  mfj: [32_200, 250_000, 403_500, 150_000, [24_800, 100_800, 211_400, 403_550, 512_450, 768_700]],
  hoh: [24_150, 200_000, 201_750, 75_000, [17_700, 67_450, 105_700, 201_750, 256_200, 640_600]],
  mfs: [16_100, 125_000, 201_775, 75_000, [12_400, 50_400, 105_700, 201_775, 256_225, 384_350]]
};

function filingRules(status) {
  if (!Object.hasOwn(FILINGS, status)) throw new RangeError('Choose a filing status.');
  const [standard, medicareThreshold, qbiThreshold, qbiRange, limits] = FILINGS[status];
  return {standard: standard * 100, medicareThreshold: medicareThreshold * 100,
    qbiThreshold: qbiThreshold * 100, qbiRange: qbiRange * 100, limits};
}

export function ordinaryTax(income, status) {
  const {limits} = filingRules(status);
  let start = 0;
  let weighted = 0;
  for (const [index, cap] of [...limits, Infinity].entries()) {
    const end = Math.min(income, cap * 100);
    weighted += (end - start) * RATES[index];
    if (end === income) break;
    start = end;
  }
  return rounded(weighted, 100);
}

function rate(amount, basisPoints) {
  return rounded(amount * basisPoints, 10000);
}

const currency = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

function rounded(numerator, denominator) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

function cents(value, label) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value?.trim());
  if (!match) {
    throw new RangeError(`Enter ${label} in dollars with up to eight digits and two decimal places.`);
  }
  const magnitude = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return magnitude;
}

function formatMoney(amounts) {
  return Object.fromEntries(Object.entries(amounts).map(([key, amount]) =>
    [key, amount === null ? '—' : currency.format(amount / 100)]));
}
