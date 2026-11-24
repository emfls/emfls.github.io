import { calculateHomeSale } from './model.mjs';

const form = document.querySelector('#sale-form');
const eligibility = form.elements.namedItem('eligibility');
const qualifyingMonths = form.elements.namedItem('monthsLived');
const partialField = document.querySelector('#partial-field');
const error = document.querySelector('#sale-error');
const results = document.querySelector('#sale-results');
const outputFields = results.querySelectorAll('[data-result]');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function updateEstimate() {
  const isPartial = eligibility.value === 'partial';
  partialField.hidden = !isPartial;
  qualifyingMonths.disabled = !isPartial;
  const values = {};

  try {
    for (const field of form.elements) {
      if (!field.name || field.disabled) continue;
      if (!field.validity.valid) {
        const label = field.labels[0].textContent;
        throw new RangeError(`${label}. ${field.validationMessage}`);
      }
      values[field.name] = field.type === 'number' ? (field.value === '' ? 0 : field.valueAsNumber) : field.value;
    }

    const estimate = calculateHomeSale(values);
    for (const field of outputFields) {
      const amount = dollars.format(estimate[field.dataset.result]);
      if (field.textContent !== amount) field.textContent = amount;
    }
    error.textContent = '';
    results.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    results.hidden = true;
    error.textContent = failure.message;
  }
}

form.addEventListener('input', updateEstimate);
form.addEventListener('change', updateEstimate);
form.addEventListener('submit', event => event.preventDefault());
updateEstimate();

for (const slot of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (slot.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
