import { calculateFuelBenefit } from './model.mjs';

const form = document.querySelector('#calculator');
const fields = form.elements;
const comparison = document.querySelector('#fuel-inputs');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const summary = document.querySelector('#summary');
const outputs = results.querySelectorAll('[data-value]');

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const miles = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = amount => pounds.format(amount);
const mileage = amount => `${miles.format(amount)} mi`;

function render() {
  const electric = fields.electric.checked;
  comparison.hidden = electric;
  comparison.disabled = electric;

  let result;
  try {
    result = calculateFuelBenefit({
      taxYear: fields.taxYear.value,
      electric,
      bikPercentage: Number(fields.bikPercentage.value),
      taxRate: Number(fields.taxRate.value),
      privateMiles: fields.privateMiles.valueAsNumber,
      mpg: fields.mpg.valueAsNumber,
      pumpPrice: fields.pumpPrice.valueAsNumber,
      monthsProvided: fields.monthsProvided.valueAsNumber,
    });
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    results.hidden = true;
    summary.textContent = '';
    error.textContent = exception.message;
    return;
  }

  error.textContent = '';
  results.hidden = false;
  for (const output of outputs) {
    const amount = result[output.dataset.value];
    const format = output.dataset.unit === 'miles' ? mileage : money;
    const card = output.closest('.metric');
    card.hidden = amount === null;
    output.textContent = amount === null ? '' : format(amount);
  }

  if (electric) {
    summary.textContent = 'Pure electric company car: £0 fuel benefit charge. The petrol and diesel comparison does not apply.';
    return;
  }

  const savings = result.netEmployeeSavings;
  if (Math.abs(savings) < 0.005) {
    summary.textContent = 'At these inputs, the employee breaks even to the nearest penny.';
  } else if (savings > 0) {
    summary.textContent = `Taking free fuel saves you ${money(savings)} over the tax year.`;
  } else {
    summary.textContent = `Paying for private fuel yourself saves you ${money(-savings)} over the tax year.`;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
