import { calculateDivision296 } from './model.mjs';

const form = document.querySelector('#calculator');
const fields = Object.fromEntries([...form.elements].map(field => [field.name, field]));
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const outputs = [...results.querySelectorAll('[data-result]')];
const dollars = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percentages = new Intl.NumberFormat('en-AU', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function render() {
  const year = fields.year.value;
  fields.openingTsb.disabled = year === '2026-27';
  document.querySelector('#future-note').hidden = year === '2026-27';

  const invalid = [...form.elements].filter(field => !field.validity.valid);
  for (const field of form.elements) {
    if (invalid.includes(field)) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
  if (invalid.length) {
    results.hidden = true;
    error.textContent = 'Enter a valid value in each marked field. Amounts are limited to A$1 billion and the outside rate is 0% to 47%.';
    error.hidden = false;
    return;
  }

  const values = calculateDivision296({
    year,
    openingTsb: fields.openingTsb.valueAsNumber,
    closingTsb: fields.closingTsb.valueAsNumber,
    superEarnings: fields.superEarnings.valueAsNumber,
    priorLoss: fields.priorLoss.valueAsNumber,
    outsideRate: fields.outsideRate.valueAsNumber,
  });
  for (const output of outputs) {
    const value = values[output.dataset.result];
    const format = output.dataset.format === 'percent' ? percentages : dollars;
    output.textContent = format.format(value);
  }
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
