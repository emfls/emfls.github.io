import { calculateNegativeGearing } from './model.mjs';

const form = document.querySelector('#gearing-form');
const results = document.querySelector('#results');
const error = document.querySelector('#form-error');
const fields = [...form.querySelectorAll('input[type="number"]')];
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

function amount(value) {
  return money.format(Math.abs(value) < 0.005 ? 0 : value);
}

function render() {
  const invalid = fields.filter(field => !field.validity.valid);
  for (const field of fields) {
    field.setAttribute('aria-invalid', String(invalid.includes(field)));
  }
  results.hidden = invalid.length > 0;
  error.textContent = invalid.length ? 'Check the highlighted fields. Enter an amount within each field’s range.' : '';
  if (invalid.length) return;

  const bucket = form.elements.bucket.value;
  const inputs = Object.fromEntries(fields.map(field => [field.name, field.valueAsNumber]));
  const comparison = calculateNegativeGearing({ ...inputs, bucket });

  for (const output of results.querySelectorAll('[data-amount]')) {
    const value = output.dataset.amount.split('.').reduce((object, key) => object[key], comparison);
    output.textContent = amount(value);
  }

  const { transition, from2027 } = comparison;
  const signs = [
    [transition, '#tax-sign-transition'],
    [from2027, '#tax-sign-reform']
  ];
  for (const [scenario, selector] of signs) {
    const tax = scenario.annualTaxBenefit;
    document.querySelector(selector).textContent = tax >= 0.005 ? 'Tax saving' :
      tax <= -0.005 ? 'Extra tax' : 'No tax change';
  }

  document.querySelector('#reform-status').textContent = bucket === 'C'
    ? 'From 1 July 2027, excess rental deductions are quarantined.'
    : 'The chosen property category retains the rental loss offset.';
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();

// Ad units are publisher-specific. Request only after a slot ID is configured.
for (const ad of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
