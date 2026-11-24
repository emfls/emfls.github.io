import { calculateDividendTax } from './model.mjs';

const form = document.querySelector('#dividend-calculator');
const inputs = [...form.querySelectorAll('input')];
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const outputs = Object.fromEntries([...results.querySelectorAll('[data-result]')]
  .map((element) => [element.dataset.result, element]));
const bandRows = results.querySelectorAll('[data-band]');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percentage = new Intl.NumberFormat('en-GB', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function render() {
  let invalidInput;
  const values = {};
  for (const input of inputs) {
    const value = input.valueAsNumber || 0;
    const valid = input.validity.valid && Math.round(value * 100) / 100 === value;
    if (!valid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    if (!valid && !invalidInput) invalidInput = input;
    values[input.name] = value;
  }
  error.hidden = !invalidInput;
  results.hidden = Boolean(invalidInput);
  if (invalidInput) {
    const label = invalidInput.labels[0].textContent;
    const maximum = Number(invalidInput.max).toLocaleString('en-GB');
    error.textContent = `${label}: enter a value from 0 to ${maximum}, with up to two decimal places.`;
    return;
  }

  const estimate = calculateDividendTax(values);
  const amounts = { ...estimate, ...estimate.bedAndIsa };
  for (const [key, output] of Object.entries(outputs)) {
    if (key === 'netYield') {
      output.textContent = estimate.netYield === null ? 'Enter portfolio value' : percentage.format(estimate.netYield / 100);
    } else {
      output.textContent = money.format(amounts[key]);
    }
  }
  estimate.bands.forEach(({ amount, tax }, index) => {
    const [amountCell, taxCell] = bandRows[index].querySelectorAll('td');
    amountCell.textContent = money.format(amount);
    taxCell.textContent = money.format(tax);
  });
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
