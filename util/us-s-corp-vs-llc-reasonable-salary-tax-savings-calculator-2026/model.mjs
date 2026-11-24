export const OASDI_CAP = 184_500;
export const MAX_AMOUNT = 10_000_000;
const SE_FACTOR = 0.9235;
const EPSILON = 1e-8;
const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];

const filingRules = {
  single: {
    deduction: 16_100, additionalMedicare: 200_000, qbiThreshold: 201_750, qbiRange: 75_000,
    bracketStarts: [0, 12_400, 50_400, 105_700, 201_775, 256_225, 640_600]
  },
  mfj: {
    deduction: 32_200, additionalMedicare: 250_000, qbiThreshold: 403_500, qbiRange: 150_000,
    bracketStarts: [0, 24_800, 100_800, 211_400, 403_550, 512_450, 768_700]
  },
  mfs: {
    deduction: 16_100, additionalMedicare: 125_000, qbiThreshold: 201_775, qbiRange: 75_000,
    bracketStarts: [0, 12_400, 50_400, 105_700, 201_775, 256_225, 384_350]
  }
};

const positive = value => Math.max(0, value);

function rulesFor(status) {
  if (!Object.hasOwn(filingRules, status)) throw new RangeError('Select a supported filing status.');
  return filingRules[status];
}

function taxFromBrackets(taxableIncome, { bracketStarts }) {
  let tax = 0;
  for (let i = 0; i < rates.length && taxableIncome > bracketStarts[i]; i++) {
    tax += rates[i] * (Math.min(taxableIncome, bracketStarts[i + 1] ?? Infinity) - bracketStarts[i]);
  }
  return tax;
}

export function federalIncomeTax(taxableIncome, status) {
  if (!Number.isFinite(taxableIncome)) throw new RangeError('Taxable income must be finite.');
  return taxFromBrackets(taxableIncome, rulesFor(status));
}

export function qualifiedBusinessDeduction({ qbi, taxableIncome, wages = 0, ubia = 0,
  sstb = false, materiallyParticipates = true, status }) {
  if (![qbi, taxableIncome, wages, ubia].every(Number.isFinite) || wages < 0 || ubia < 0) {
    throw new RangeError('Enter finite amounts and nonnegative wages and property basis.');
  }
  return qbiDeduction(qbi, taxableIncome, wages, ubia, sstb, materiallyParticipates, rulesFor(status));
}

function qbiDeduction(qbi, taxableIncome, wages, ubia, sstb, materiallyParticipates, rules) {
  const phase = Math.min(1, positive(taxableIncome - rules.qbiThreshold) / rules.qbiRange);
  const applicable = sstb ? 1 - phase : 1;
  const eligibleQbi = positive(qbi) * applicable;
  const tentative = 0.2 * eligibleQbi;
  const wagePropertyLimit = applicable * Math.max(0.5 * wages, 0.25 * wages + 0.025 * ubia);
  const afterWageLimit = tentative - phase * positive(tentative - wagePropertyLimit);
  const standardQbi = Math.min(afterWageLimit, 0.2 * positive(taxableIncome));
  const minimum = materiallyParticipates && eligibleQbi >= 1000 ? 400 : 0;
  return Math.max(standardQbi, minimum);
}

function comparisonContext({
  profit, salary, overhead = 2500, ownerWages = 0, spouseWages = 0, otherIncome = 0, ubia = 0,
  status = 'single', sstb = false, materiallyParticipates = true
}) {
  const rules = rulesFor(status);
  if (![profit, salary, overhead, ownerWages, spouseWages, otherIncome, ubia]
    .every(amount => Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT)) {
    throw new RangeError('Enter amounts from $0 to $10,000,000.');
  }
  const householdWages = ownerWages + (status === 'mfj' ? spouseWages : 0);
  const outsideIncome = householdWages + otherIncome;
  const availableOasdi = positive(OASDI_CAP - ownerWages);
  const medicareThresholdRemaining = positive(rules.additionalMedicare - householdWages);
  const employerFica = 0.062 * Math.min(salary, OASDI_CAP) + 0.0145 * salary;
  const employeeOasdi = 0.062 * Math.min(salary, availableOasdi);
  const employeeMedicare = 0.0145 * salary;
  const fundingRequired = salary + employerFica + overhead;
  return { profit, salary, overhead, ubia, sstb, materiallyParticipates, rules, outsideIncome,
    availableOasdi, medicareThresholdRemaining, employerFica, employeeOasdi, employeeMedicare, fundingRequired };
}

function incomeAfterQbi(qbi, ordinaryIncome, wages, context) {
  const { rules, ubia, sstb, materiallyParticipates, outsideIncome } = context;
  const beforeQbi = positive(ordinaryIncome + outsideIncome - rules.deduction);
  const deduction = qbiDeduction(qbi, beforeQbi, wages, ubia, sstb, materiallyParticipates, rules);
  const taxableIncome = positive(beforeQbi - deduction);
  return { beforeQbi, deduction, taxableIncome, incomeTax: taxFromBrackets(taxableIncome, rules),
    qbiTaxBenefit: taxFromBrackets(beforeQbi, rules) - taxFromBrackets(taxableIncome, rules) };
}

function compareAtProfit(profit, context) {
  const { salary, overhead, availableOasdi, medicareThresholdRemaining,
    employerFica, employeeOasdi, employeeMedicare, fundingRequired } = context;
  const seEarnings = SE_FACTOR * profit;
  const llcOasdi = seEarnings >= 400 ? 0.124 * Math.min(seEarnings, availableOasdi) : 0;
  const llcMedicare = seEarnings >= 400 ? 0.029 * seEarnings : 0;
  const llcAdditionalMedicare = seEarnings >= 400
    ? 0.009 * positive(seEarnings - medicareThresholdRemaining) : 0;
  // Schedule SE excludes Additional Medicare Tax, which is calculated separately on Form 8959.
  const halfSeTaxDeduction = 0.5 * (llcOasdi + llcMedicare);
  const llcQbi = positive(profit - halfSeTaxDeduction);
  const llcIncome = incomeAfterQbi(llcQbi, llcQbi, 0, context);
  const llcPayroll = llcOasdi + llcMedicare + llcAdditionalMedicare;
  const llcTotal = llcIncome.incomeTax + llcPayroll;

  const employeeAdditionalMedicare = 0.009 * positive(salary - medicareThresholdRemaining);
  const employeeFica = employeeOasdi + employeeMedicare + employeeAdditionalMedicare;
  const sCorpPayroll = employerFica + employeeFica;
  const passThrough = positive(profit - fundingRequired);
  const shortfall = profit + EPSILON < fundingRequired ? fundingRequired - profit : 0;
  const sCorpIncome = shortfall > 0 ? null : incomeAfterQbi(passThrough, salary + passThrough, salary, context);
  const sCorpTotal = sCorpIncome ? sCorpIncome.incomeTax + sCorpPayroll + overhead : null;

  return {
    llc: { ...llcIncome, seEarnings, oasdi: llcOasdi, medicare: llcMedicare,
      additionalMedicare: llcAdditionalMedicare, halfSeTaxDeduction, qbi: llcQbi, payroll: llcPayroll, total: llcTotal },
    sCorp: { ...sCorpIncome, employerFica, employeeFica, employeeOasdi, employeeAdditionalMedicare,
      payroll: sCorpPayroll, passThrough, qbi: sCorpIncome ? passThrough : null, overhead, total: sCorpTotal },
    shortfall,
    fundingRequired,
    salaryRatio: profit > 0 ? salary / profit : null,
    qbiSavingsEffect: sCorpIncome ? sCorpIncome.qbiTaxBenefit - llcIncome.qbiTaxBenefit : null,
    netSavings: sCorpTotal === null ? null : llcTotal - sCorpTotal
  };
}

export function compareTaxes(inputs) {
  const context = comparisonContext(inputs);
  return compareAtProfit(context.profit, context);
}

export function breakEvenProfit(inputs) {
  const context = comparisonContext(inputs);
  if (context.salary === 0) return null;

  let profit = Math.ceil(context.fundingRequired - EPSILON);
  while (profit <= MAX_AMOUNT) {
    const { netSavings } = compareAtProfit(profit, context);
    if (netSavings >= -EPSILON) return profit;
    // Continuous changes are below $4 per $1 of profit, including the SSTB phase-in.
    // Allow $296 for both $400 QBI minimums at 37%, plus a conservative allowance for the Schedule SE $400 earnings cliff.
    profit += Math.max(1, Math.floor((-netSavings - 450) / 4));
  }
  return null;
}
