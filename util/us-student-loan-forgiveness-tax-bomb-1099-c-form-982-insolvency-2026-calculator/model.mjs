// IRS Rev. Proc. 2025-32, sections 4.01 and 4.14.
const RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
function brackets(...ceilings) {
  return Object.freeze([...ceilings, Infinity].map((ceiling, index) =>
    Object.freeze([ceiling, RATES[index]])));
}

export const BRACKETS_2026 = Object.freeze({
  single: brackets(12400, 50400, 105700, 201775, 256225, 640600),
  mfj: brackets(24800, 100800, 211400, 403550, 512450, 768700),
  hoh: brackets(17700, 67450, 105700, 201750, 256200, 640600),
});
export const STANDARD_DEDUCTIONS_2026 = Object.freeze({
  single: 16100,
  mfj: 32200,
  hoh: 24150,
});

const PROGRAMS = new Set(['idr_taxable', 'pslf_tax_free', 'tlf_tax_free', 'tpd_tax_free']);
const MAX_AMOUNT = 1_000_000_000;

function toCents(amount) {
  const scaled = amount * 100;
  return Math.sign(scaled) * Math.round(Math.abs(scaled) * (1 + Number.EPSILON));
}

function validateNumber(value, label, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter ${label} between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
  }
}

function filingBrackets(filingStatus) {
  if (!Object.hasOwn(BRACKETS_2026, filingStatus)) {
    throw new RangeError('Select a supported filing status.');
  }
  return BRACKETS_2026[filingStatus];
}

function taxBetweenCents(schedule, lowerIncomeCents, upperIncomeCents) {
  let weightedCents = 0;
  let floor = 0;
  for (const [ceiling, rate] of schedule) {
    const ceilingCents = ceiling * 100;
    if (upperIncomeCents <= floor) break;
    const slice = Math.min(upperIncomeCents, ceilingCents) - Math.max(lowerIncomeCents, floor);
    weightedCents += Math.max(0, slice) * Math.round(rate * 100);
    floor = ceilingCents;
  }
  return Math.round(weightedCents / 100);
}

export function federalIncomeTax(filingStatus, taxableIncome) {
  validateNumber(taxableIncome, 'taxable income', -MAX_AMOUNT, 2 * MAX_AMOUNT);
  return taxBetweenCents(filingBrackets(filingStatus), 0, toCents(taxableIncome)) / 100;
}

export function calculateForgivenessTax({
  program, filingStatus, forgivenBalance, agi, totalAssetsFmv, totalLiabilities,
  stateRate, yearsUntilForgiveness,
}) {
  if (!PROGRAMS.has(program)) throw new RangeError('Select a supported forgiveness program.');
  const taxableProgram = program === 'idr_taxable';
  validateNumber(forgivenBalance, 'the forgiven balance', 0, MAX_AMOUNT);
  validateNumber(agi, 'your AGI', -MAX_AMOUNT, MAX_AMOUNT);
  validateNumber(totalAssetsFmv, 'total asset value', 0, MAX_AMOUNT);
  validateNumber(totalLiabilities, 'total liabilities', 0, MAX_AMOUNT);
  validateNumber(stateRate, 'the state tax rate', 0, 100);
  validateNumber(yearsUntilForgiveness, 'years until discharge', 0, 100);

  const forgivenCents = toCents(forgivenBalance);
  const liabilityCents = toCents(totalLiabilities);
  if (taxableProgram && liabilityCents < forgivenCents) {
    throw new RangeError('Total liabilities must include the full forgiven balance.');
  }

  const deficitCents = Math.max(0, liabilityCents - toCents(totalAssetsFmv));
  const preExclusionCents = taxableProgram ? forgivenCents : 0;
  const excludedCents = Math.min(preExclusionCents, deficitCents);
  const taxableCodCents = preExclusionCents - excludedCents;

  const schedule = filingBrackets(filingStatus);
  const incomeAfterDeduction = toCents(agi) - STANDARD_DEDUCTIONS_2026[filingStatus] * 100;
  const baselineTaxCents = taxBetweenCents(schedule, 0, incomeAfterDeduction);
  const beforeFormCents = taxBetweenCents(schedule, incomeAfterDeduction, incomeAfterDeduction + preExclusionCents);
  const afterFormCents = taxBetweenCents(schedule, incomeAfterDeduction, incomeAfterDeduction + taxableCodCents);
  const stateTaxCents = toCents(taxableCodCents / 100 * (stateRate / 100));
  const totalTaxCents = afterFormCents + stateTaxCents;
  const monthsUntilForgiveness = Math.floor(yearsUntilForgiveness * 12);
  let monthlySavings = 0;
  if (totalTaxCents > 0) {
    monthlySavings = monthsUntilForgiveness === 0
      ? null
      : Math.ceil(totalTaxCents / monthsUntilForgiveness) / 100;
  }

  return {
    insolvencyDeficit: deficitCents / 100,
    insolvencyExcluded: excludedCents / 100,
    taxableCodIncome: taxableCodCents / 100,
    baselineFederalTax: baselineTaxCents / 100,
    taxWithoutForm982: beforeFormCents / 100,
    taxWithForm982: afterFormCents / 100,
    form982TaxSavings: (beforeFormCents - afterFormCents) / 100,
    stateTax: stateTaxCents / 100,
    totalTax: totalTaxCents / 100,
    monthlySavings,
  };
}
