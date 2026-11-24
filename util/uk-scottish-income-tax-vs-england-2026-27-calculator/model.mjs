const STANDARD_ALLOWANCE = 12_570;
const TAPER_START = 100_000;
const ADDITIONAL_THRESHOLD = 125_140;
const NI_UPPER_LIMIT = 50_270;
const SCOTTISH_HIGHER_THRESHOLD = 43_662;
const SCOTTISH_STARTER_LIMIT = 3_967;

const bands = {
  scotland: [
    [SCOTTISH_STARTER_LIMIT, .19],
    [16_956, .20],
    [SCOTTISH_HIGHER_THRESHOLD - STANDARD_ALLOWANCE, .21],
    [62_430, .42],
    [ADDITIONAL_THRESHOLD, .45],
    [Infinity, .48]
  ],
  restOfUk: [
    [37_700, .20],
    [ADDITIONAL_THRESHOLD, .40],
    [Infinity, .45]
  ]
};

const loans = {
  none: [0, 0],
  plan2: [29_385, .09],
  plan4: [33_795, .09],
  postgrad: [21_000, .06]
};

const positive = value => Math.max(0, value);
const roundPence = value => Math.round(value * 100) / 100;

export function personalAllowance(adjustedNetIncome) {
  return positive(STANDARD_ALLOWANCE - positive(adjustedNetIncome - TAPER_START) / 2);
}

export function incomeTax(payBeforeAllowance, region, grossReliefAtSource = 0) {
  if (!Object.hasOwn(bands, region)) throw new RangeError('Unknown tax region');
  const taxable = positive(payBeforeAllowance - personalAllowance(payBeforeAllowance - grossReliefAtSource));
  let lower = 0;
  let tax = 0;
  for (const [limit, rate] of bands[region]) {
    // HMRC extends all finite employment-income limits except the Scottish starter limit.
    const upper = limit === SCOTTISH_STARTER_LIMIT ? limit : limit + grossReliefAtSource;
    tax += positive(Math.min(taxable, upper) - lower) * rate;
    if (taxable <= upper) break;
    lower = upper;
  }
  return tax;
}

export function nationalInsurance(pay) {
  return positive(Math.min(pay, NI_UPPER_LIMIT) - STANDARD_ALLOWANCE) * .08
    + positive(pay - NI_UPPER_LIMIT) * .02;
}

export function studentLoan(pay, plan) {
  if (!Object.hasOwn(loans, plan)) throw new RangeError('Unknown student loan plan');
  const [threshold, rate] = loans[plan];
  return positive(pay - threshold) * rate;
}

function calculate(salary, pensionPercent, pensionMethod, loanPlan) {
  const pensionContribution = roundPence(salary * (pensionPercent / 100));
  const atSource = pensionMethod === 'relief-at-source';
  const pay = atSource ? salary : salary - pensionContribution;
  const bandExtension = atSource ? pensionContribution : 0;
  const pensionCashCost = atSource ? roundPence(pensionContribution * .80) : pensionContribution;
  const ni = nationalInsurance(pay);
  const loan = studentLoan(pay, loanPlan);

  function regionPay(region) {
    const tax = incomeTax(pay, region, bandExtension);
    const annualTakeHome = salary - pensionCashCost - tax - ni - loan;
    return { incomeTax: tax, annualTakeHome, monthlyTakeHome: annualTakeHome / 12 };
  }

  return {
    pensionContribution,
    pensionCashCost,
    pensionProviderTopUp: roundPence(pensionContribution - pensionCashCost),
    adjustedNetIncome: salary - pensionContribution,
    nationalInsurance: ni,
    studentLoan: loan,
    scotland: regionPay('scotland'),
    restOfUk: regionPay('restOfUk')
  };
}

export function comparePay({ salary, pensionPercent = 0, pensionMethod = 'sacrifice', loanPlan = 'none' }) {
  if (!Number.isFinite(salary) || salary < 0 || salary > 1_000_000_000
      || !Number.isFinite(pensionPercent) || pensionPercent < 0 || pensionPercent > 100) {
    throw new RangeError('Salary must be between £0 and £1 billion and pension between 0% and 100%.');
  }
  if (pensionMethod !== 'sacrifice' && pensionMethod !== 'relief-at-source') {
    throw new RangeError('Unknown pension method');
  }

  const annualSalary = roundPence(salary);
  const current = calculate(annualSalary, pensionPercent, pensionMethod, loanPlan);
  const next = calculate(annualSalary + 1_000, pensionPercent, pensionMethod, loanPlan);
  const extraPayrollDeductions = next.nationalInsurance - current.nationalInsurance
    + next.studentLoan - current.studentLoan;

  for (const region of ['scotland', 'restOfUk']) {
    const extraTax = next[region].incomeTax - current[region].incomeTax;
    current[region].nextThousandRate = (extraTax + extraPayrollDeductions) / 1_000;
  }

  function pensionTarget(threshold) {
    const total = roundPence(positive(annualSalary - threshold));
    return { total, additional: roundPence(positive(total - current.pensionContribution)) };
  }

  const annualTaxDifference = current.scotland.incomeTax - current.restOfUk.incomeTax;
  return {
    ...current,
    personalAllowance: personalAllowance(current.adjustedNetIncome),
    annualTaxDifference,
    monthlyTaxDifference: annualTaxDifference / 12,
    taperTarget: pensionTarget(TAPER_START),
    scottishHigherTarget: pensionTarget(SCOTTISH_HIGHER_THRESHOLD)
  };
}
