import { comparePay } from './model.mjs';

const element = id => document.getElementById(id);
const form = element('pay-calculator');
const salary = element('salary');
const pensionPercent = element('pension-percent');
const pensionMethod = element('pension-method');
const loanPlan = element('loan-plan');
const results = element('pay-results');
const error = element('input-error');
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });

function write(id, value) {
  element(id).textContent = value;
}

function render() {
  let message = '';
  if (!salary.validity.valid) {
    message = 'Enter an annual salary in pounds and pence, from £0 to £1 billion.';
  } else if (!pensionPercent.validity.valid) {
    message = 'Enter a pension percentage from 0 to 100.';
  }

  for (const input of [salary, pensionPercent]) {
    input.setAttribute('aria-invalid', String(!input.validity.valid));
  }
  error.textContent = message;
  error.classList.toggle('hidden', !message);
  results.hidden = Boolean(message);
  if (message) return;

  const pay = comparePay({
    salary: salary.valueAsNumber,
    pensionPercent: pensionPercent.valueAsNumber,
    pensionMethod: pensionMethod.value,
    loanPlan: loanPlan.value
  });

  for (const [prefix, region] of [['sc', pay.scotland], ['uk', pay.restOfUk]]) {
    write(`${prefix}-monthly`, pounds.format(region.monthlyTakeHome));
    write(`${prefix}-annual`, pounds.format(region.annualTakeHome));
    write(`${prefix}-tax`, pounds.format(region.incomeTax));
    write(`${prefix}-ni`, pounds.format(pay.nationalInsurance));
    write(`${prefix}-loan`, pounds.format(pay.studentLoan));
    write(`${prefix}-marginal`, percent.format(region.nextThousandRate));
  }

  const annualGap = Math.abs(pay.annualTaxDifference);
  const monthlyGap = Math.abs(pay.monthlyTaxDifference);
  const direction = pay.annualTaxDifference > 0 ? 'more' : 'less';
  const gap = annualGap < .005
    ? 'Income Tax is the same to the nearest penny.'
    : `Scotland costs ${pounds.format(annualGap)} ${direction} in Income Tax per year (${pounds.format(monthlyGap)} per month).`;
  write('tax-difference', gap);

  const pension = `Gross pension: ${pounds.format(pay.pensionContribution)}. `;
  const provider = pensionMethod.value === 'relief-at-source'
    ? `Your payment: ${pounds.format(pay.pensionCashCost)} before any further tax relief. Provider top-up: ${pounds.format(pay.pensionProviderTopUp)}. `
    : '';
  write('pension-summary', `${pension}${provider}Adjusted net income: ${pounds.format(pay.adjustedNetIncome)}. Personal Allowance: ${pounds.format(pay.personalAllowance)}.`);
  for (const [prefix, target] of [['taper', pay.taperTarget], ['higher', pay.scottishHigherTarget]]) {
    write(`${prefix}-total`, pounds.format(target.total));
    write(`${prefix}-additional`, pounds.format(target.additional));
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
