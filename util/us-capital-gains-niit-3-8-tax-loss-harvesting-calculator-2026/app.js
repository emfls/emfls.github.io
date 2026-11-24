import { calculate } from './model.mjs';

const form = document.querySelector('#tax-form');
const amounts = Array.from(form.querySelectorAll('input[type="number"]'));
const status = form.elements.namedItem('status');
const estimates = document.querySelector('#estimates');
const error = document.querySelector('#error');
const metrics = estimates.querySelectorAll('dd[id]');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function showError(message) {
  error.textContent = message;
  error.hidden = false;
  estimates.hidden = true;
}

function update() {
  const invalid = amounts.find((field) => !field.validity.valid);
  if (invalid) {
    showError(`${invalid.labels[0].textContent}: ${invalid.validationMessage}`);
    return;
  }

  const inputs = { status: status.value };
  for (const field of amounts) {
    if (field.value !== '') inputs[field.name] = field.valueAsNumber;
  }
  let result;
  try {
    result = calculate(inputs);
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    showError(exception.message);
    return;
  }

  error.hidden = true;
  for (const metric of metrics) {
    metric.textContent = dollars.format(result[metric.dataset.metric ?? metric.id]);
  }
  estimates.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
