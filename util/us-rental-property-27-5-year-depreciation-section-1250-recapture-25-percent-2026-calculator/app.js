import { calculateRentalProperty } from './model.mjs';

const form = document.getElementById('rental-form');
const fields = [...form.elements].filter(field => field.name);
const estimate = document.getElementById('estimate');
const outputs = estimate.querySelectorAll('[data-result]');
const error = document.getElementById('input-error');
const exitContext = document.getElementById('exit-context');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function readField(field) {
  if (field.type === 'number') return field.valueAsNumber;
  if (field.type === 'checkbox') return field.checked;
  if (field.name === 'ordinaryMarginalRate' || field.name === 'ltcgRate') return Number(field.value) / 100;
  return field.value;
}

function render() {
  const values = Object.fromEntries(fields.map(field => [field.name, readField(field)]));
  let result;
  try {
    result = calculateRentalProperty(values);
  } catch (issue) {
    if (!(issue instanceof RangeError || issue instanceof TypeError)) throw issue;
    estimate.hidden = true;
    error.textContent = issue.message;
    return;
  }

  error.textContent = '';
  estimate.hidden = false;
  for (const output of outputs) {
    output.textContent = dollars.format(result[output.dataset.result]);
  }
  exitContext.textContent = result.exitTax < 0 ? 'Estimated net reduction in federal tax.' : '';
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
