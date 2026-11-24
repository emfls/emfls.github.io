import { estimatePlan } from './model.mjs';

const form = document.getElementById('plan-inputs');
const error = document.getElementById('input-error');
const projection = document.getElementById('projection');
const inputs = Array.from(form.querySelectorAll('input'));
const outputs = Array.from(document.querySelectorAll('.metric dd'));
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function renderProjection(years) {
  const rows = years.map(({ year, payCredit, balance }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = String(year);
    row.append(heading);
    row.insertCell().textContent = money.format(payCredit);
    row.insertCell().textContent = money.format(balance);
    return row;
  });
  projection.replaceChildren(...rows);
}

function render() {
  for (const input of inputs) input.removeAttribute('aria-invalid');
  try {
    const invalid = inputs.find(input => !input.validity.valid);
    if (invalid) {
      invalid.setAttribute('aria-invalid', 'true');
      const label = invalid.labels[0].textContent;
      throw new RangeError(`${label} requires a number from ${invalid.min} through ${invalid.max}.`);
    }
    const values = Object.fromEntries(inputs.map(input => [input.id, input.valueAsNumber]));
    const result = estimatePlan(values);
    for (const output of outputs) output.textContent = money.format(result[output.id]);
    renderProjection(result.projection);
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    for (const output of outputs) output.textContent = '—';
    projection.replaceChildren();
    error.textContent = problem.message;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
