import { calculateCis } from './model.mjs';

const form = document.querySelector('#cis-form');
const estimate = document.querySelector('#cis-estimate');
const error = document.querySelector('#cis-error');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const numericFields = [...form.querySelectorAll('input[type="number"]')];
const figures = {
  'cis-deducted': 'cisDeducted',
  'monthly-cis': 'monthlyCis',
  'cis-base': 'cisLabourBase',
  profit: 'profit',
  allowance: 'personalAllowance',
  'income-tax': 'incomeTax',
  class4: 'class4',
  liability: 'liability',
  'registration-saving': 'registrationSaving',
  backdate: 'backdateEstimate',
};

function render() {
  const inputs = Object.fromEntries(new FormData(form));
  const invalid = numericFields.find(field => !field.validity.valid);
  for (const field of numericFields) {
    field.setAttribute('aria-invalid', String(!field.validity.valid));
    field.setAttribute('aria-errormessage', 'cis-error');
    inputs[field.name] = field.value === '' ? 0 : field.valueAsNumber;
  }

  if (invalid) {
    error.textContent = invalid.name === 'priorYears'
      ? 'Enter a whole number from 1 to 4 for unclaimed prior tax years.'
      : `Check “${invalid.labels[0].textContent}”. Enter £0 to £1 billion with up to two decimal places.`;
    estimate.hidden = true;
    return;
  }

  let result;
  try {
    result = calculateCis(inputs);
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    estimate.hidden = true;
    return;
  }
  error.textContent = '';
  for (const [id, key] of Object.entries(figures)) {
    document.getElementById(id).textContent = money.format(result[key]);
  }
  document.querySelector('#backdate-label').textContent =
    `Illustrative rebate for ${inputs.priorYears} prior ${inputs.priorYears === 1 ? 'year' : 'years'}`;
  document.querySelector('#class2-note').hidden = !result.voluntaryClass2Weekly;
  estimate.hidden = false;
  const outcome = document.querySelector('#outcome');
  const summary = result.refund > 0
    ? `Estimated refund: ${money.format(result.refund)}`
    : result.balanceDue > 0
      ? `Estimated balance due: ${money.format(result.balanceDue)}`
      : 'Estimated refund or balance due: £0.00';
  if (outcome.textContent !== summary) outcome.textContent = summary;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
window.addEventListener('pageshow', render);
render();
