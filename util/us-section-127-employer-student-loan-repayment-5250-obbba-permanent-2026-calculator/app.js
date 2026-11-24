import { calculateBenefit, comparePayoff } from './model.mjs';

const element = id => document.getElementById(id);
const form = element('section127-form');
const results = element('results');
const inputError = element('input-error');
const payoffNote = element('payoff-note');
const numberInputs = [...form.querySelectorAll('input[type="number"]')];
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthFormat = new Intl.NumberFormat('en-US');

function money(value) {
  return value === null ? '—' : usd.format(value);
}

function months(value) {
  if (value === null) return '—';
  return `${monthFormat.format(value)} ${value === 1 ? 'month' : 'months'}`;
}

function render() {
  const invalid = numberInputs.find(input => !input.validity.valid);
  if (invalid) {
    inputError.textContent = `${invalid.labels[0].textContent}: enter a value from ${invalid.min} to ${invalid.max} with up to two decimal places.`;
    results.hidden = true;
    return;
  }

  const benefit = calculateBenefit({
    loanAssistance: element('loan-assistance').valueAsNumber,
    tuition: element('tuition').valueAsNumber,
    wages: element('wages').valueAsNumber,
    otherMedicareWages: element('other-medicare-wages').valueAsNumber,
    filing: element('filing').value,
    federalRate: Number(element('federal-rate').value),
    stateRate: element('state-rate').valueAsNumber,
    stateConforms: element('state-treatment').value === 'conforms'
  });
  const loan = comparePayoff({
    balance: element('balance').valueAsNumber,
    annualRate: element('annual-rate').valueAsNumber,
    monthlyPayment: element('monthly-payment').valueAsNumber,
    monthlyLoanBenefit: benefit.monthlyLoanBenefit
  });

  const dollars = {
    'tax-free-loan': benefit.taxFreeLoan,
    'tax-free-tuition': benefit.taxFreeTuition,
    'tax-free-total': benefit.taxFreeTotal,
    'taxable-excess': benefit.taxableExcess,
    'monthly-benefit': benefit.monthlyLoanBenefit,
    'equivalent-cash': benefit.equivalentCash,
    'employee-savings': benefit.employeeTaxSavings,
    'employer-savings': benefit.employerFicaSavings,
    'employer-gross-up-savings': benefit.employerGrossUpFicaSavings,
    'baseline-interest': loan.baseline.interest,
    'accelerated-interest': loan.accelerated.interest,
    'interest-saved': loan.interestSaved
  };
  for (const [id, value] of Object.entries(dollars)) element(id).textContent = money(value);
  element('baseline-months').textContent = months(loan.baseline.months);
  element('accelerated-months').textContent = months(loan.accelerated.months);
  element('months-saved').textContent = months(loan.monthsSaved);
  payoffNote.hidden = loan.monthsSaved !== null;
  payoffNote.textContent = payoffNote.hidden ? ''
    : 'A dash means payoff could not be calculated within 1,200 months, or a comparison depends on that missing payoff.';
  inputError.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
