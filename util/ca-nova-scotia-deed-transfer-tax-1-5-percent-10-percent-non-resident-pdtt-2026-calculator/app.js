import { calculateTransferTaxes, MAX_PRICE, municipalRates } from './model.mjs';

const form = document.querySelector('#calculator');
const output = document.querySelector('#results');
const error = document.querySelector('#error');
const field = (name) => form.elements.namedItem(name);
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 });

for (const name of ['purchasePrice', 'assessedValue']) field(name).max = MAX_PRICE;
for (const option of field('municipality').options) {
  if (Object.hasOwn(municipalRates, option.value)) {
    option.textContent += ' · ' + municipalRates[option.value].toFixed(2) + '%';
  }
}

function update() {
  const custom = field('municipality').value === 'custom';
  field('customRate').disabled = !custom;
  document.querySelector('#custom-rate-field').hidden = !custom;

  try {
    const values = {};
    for (const input of form.querySelectorAll('input:not(:disabled), select')) {
      if (!input.validity.valid) {
        throw new RangeError(input.labels[0].textContent + '. ' + input.validationMessage);
      }
      values[input.name] = input.type === 'number' ? input.valueAsNumber : input.value;
    }
    const taxes = calculateTransferTaxes(values);
    for (const cell of output.querySelectorAll('[data-money]')) {
      cell.textContent = currency.format(taxes[cell.dataset.money]);
    }
    document.querySelector('#total-percent').textContent = percent.format(taxes.totalPctOfPrice) + '% of purchase price';
    document.querySelector('#municipal-rate').textContent = taxes.municipalRate.toFixed(2) + '%';
    error.hidden = true;
    output.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    output.hidden = true;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
