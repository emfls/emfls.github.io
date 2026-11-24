export const ANNUAL_LIMIT = 5250;
export const SOCIAL_SECURITY_CAP = 184500;
const SOCIAL_SECURITY = 0.062;
const MEDICARE = 0.0145;
const ADDITIONAL_MEDICARE = 0.009;
const MAX_MONTHS = 1200;
const MAX_DOLLARS = 1e9;
const MEDICARE_THRESHOLDS = Object.freeze({ single: 200000, joint: 250000, separate: 125000 });

function checkRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

export function calculateBenefit({
  loanAssistance, tuition, wages, otherMedicareWages, filing, federalRate, stateRate, stateConforms
}) {
  checkRange(loanAssistance, 0, MAX_DOLLARS, 'Annual employer loan payments');
  checkRange(tuition, 0, MAX_DOLLARS, 'Annual tuition assistance');
  checkRange(wages, 0, MAX_DOLLARS, 'Annual wages from this employer');
  checkRange(otherMedicareWages, 0, MAX_DOLLARS, 'Other Medicare wages');
  checkRange(federalRate, 0, 37, 'Federal marginal rate');
  checkRange(stateRate, 0, 20, 'State marginal rate');
  if (!Object.hasOwn(MEDICARE_THRESHOLDS, filing) || typeof stateConforms !== 'boolean') {
    throw new RangeError('Choose a filing status and state tax treatment.');
  }

  // Allocate the shared annual exclusion to tuition first and calculate in cents.
  const tuitionCents = Math.round(tuition * 100);
  const loanCents = Math.round(loanAssistance * 100);
  const taxFreeTuitionCents = Math.min(ANNUAL_LIMIT * 100, tuitionCents);
  const taxFreeLoanCents = Math.min(ANNUAL_LIMIT * 100 - taxFreeTuitionCents, loanCents);
  const taxFreeLoan = taxFreeLoanCents / 100;
  const taxFreeTuition = taxFreeTuitionCents / 100;
  const taxableExcess = (tuitionCents + loanCents - taxFreeTuitionCents - taxFreeLoanCents) / 100;

  // The cash comparison replaces the excluded loan benefit while leaving tuition and taxable excess in place.
  const wagesBeforeCash = wages + taxableExcess;
  const socialSecurityRoom = Math.max(0, SOCIAL_SECURITY_CAP - wagesBeforeCash);
  const medicareRoom = Math.max(0, MEDICARE_THRESHOLDS[filing] - wagesBeforeCash - otherMedicareWages);

  const employerFica = amount => SOCIAL_SECURITY * Math.min(amount, socialSecurityRoom) + MEDICARE * amount;
  const employeeTax = amount => employerFica(amount)
    + ADDITIONAL_MEDICARE * Math.max(0, amount - medicareRoom)
    + ((federalRate + stateRate) / 100) * amount;

  const equivalentNet = taxFreeLoan * (stateConforms ? 1 : 1 - stateRate / 100);
  // Solve net cash = gross cash minus incremental taxes across payroll thresholds.
  // Within a single rate segment this is net cash / (1 - combined marginal rate).
  let lower = 0;
  let upper = equivalentNet / (1 - (federalRate + stateRate) / 100
    - SOCIAL_SECURITY - MEDICARE - ADDITIONAL_MEDICARE);
  for (let i = 0; i < 48; i += 1) {
    const gross = (lower + upper) / 2;
    if (gross - employeeTax(gross) < equivalentNet) lower = gross;
    else upper = gross;
  }
  const equivalentCash = (lower + upper) / 2;

  return {
    taxFreeLoan,
    taxFreeTuition,
    taxFreeTotal: (taxFreeLoanCents + taxFreeTuitionCents) / 100,
    taxableExcess,
    monthlyLoanBenefit: taxFreeLoan / 12,
    employeeTaxSavings: employeeTax(taxFreeLoan) - (stateConforms ? 0 : taxFreeLoan * stateRate / 100),
    equivalentCash,
    employerFicaSavings: employerFica(taxFreeLoan),
    employerGrossUpFicaSavings: employerFica(equivalentCash)
  };
}

function payoff(balance, monthlyRate, payment) {
  if (balance === 0) return { months: 0, interest: 0 };
  if (payment <= balance * monthlyRate) return { months: null, interest: null };

  let interest = 0;
  for (let month = 1; month <= MAX_MONTHS; month += 1) {
    const charge = balance * monthlyRate;
    interest += charge;
    const due = balance + charge;
    // Ignore floating-point residue below one millionth of a cent.
    if (due - payment <= 1e-8) return { months: month, interest };
    balance = due - payment;
  }
  return { months: null, interest: null };
}

export function comparePayoff({ balance, annualRate, monthlyPayment, monthlyLoanBenefit }) {
  checkRange(balance, 0, MAX_DOLLARS, 'Loan balance');
  checkRange(annualRate, 0, 50, 'Loan APR');
  checkRange(monthlyPayment, 0, MAX_DOLLARS, 'Monthly payment');
  checkRange(monthlyLoanBenefit, 0, ANNUAL_LIMIT / 12, 'Monthly tax-free benefit');

  const monthlyRate = annualRate / 1200;
  const baseline = payoff(balance, monthlyRate, monthlyPayment);
  const accelerated = payoff(balance, monthlyRate, monthlyPayment + monthlyLoanBenefit);
  const bothPayOff = baseline.months !== null && accelerated.months !== null;
  return {
    baseline,
    accelerated,
    monthsSaved: bothPayOff ? baseline.months - accelerated.months : null,
    interestSaved: bothPayOff ? Math.max(0, baseline.interest - accelerated.interest) : null
  };
}
