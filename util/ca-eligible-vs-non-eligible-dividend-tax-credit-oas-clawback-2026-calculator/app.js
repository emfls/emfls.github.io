import { calculateDividend } from './model.mjs';

const form = document.querySelector('#calculator');
const { province, dividendType, cash, other, receivingOas, pension } = form.elements;
const pensionField = document.querySelector('#pension-field');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percentage = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const rateLabel = value => value === null ? '—' : percentage.format(value);

function update() {
  pensionField.hidden = pension.disabled = !receivingOas.checked;
  const invalid = [cash, other, pension].find(field => !field.disabled && !field.validity.valid);
  const pensionExceedsIncome = receivingOas.checked && pension.valueAsNumber > other.valueAsNumber;
  for (const field of [cash, other, pension]) {
    if (field === invalid || (field === pension && pensionExceedsIncome)) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
  }
  results.hidden = Boolean(invalid || pensionExceedsIncome);
  error.textContent = invalid
    ? `Enter a CAD amount from $0 to $100,000,000, to the nearest cent, for ${invalid.dataset.label}.`
    : pensionExceedsIncome ? 'Include your gross annual OAS pension in other taxable income.' : '';
  if (results.hidden) return;

  const estimate = calculateDividend({
    province: province.value,
    type: dividendType.value,
    cashDividend: cash.valueAsNumber,
    otherIncome: other.valueAsNumber,
    receivingOas: receivingOas.checked,
    oasPension: receivingOas.checked ? pension.valueAsNumber : 0,
  });
  for (const output of results.querySelectorAll('[data-money]')) {
    output.textContent = currency.format(estimate[output.dataset.money]);
  }
  for (const output of results.querySelectorAll('[data-percent]')) {
    output.textContent = rateLabel(estimate[output.dataset.percent]);
  }
  document.querySelector('#tax-line').textContent = dividendType.value === 'eligible'
    ? 'Line 12000' : 'Lines 12000 and 12010';
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
