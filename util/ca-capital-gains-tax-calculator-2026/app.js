import { calculateCapitalGains } from './model.mjs';

const form = document.querySelector('#calculator');
const fields = [...form.querySelectorAll('input[type="number"]')];
const results = document.querySelector('#results');
const outputs = results.querySelectorAll('[data-result]');
const placeholder = document.querySelector('#results-placeholder');
const error = document.querySelector('#input-error');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const rate = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });

function render() {
  const lcgeEligible = form.elements.lcgeEligible.checked;
  const spouseShare = form.elements.spouseShare.valueAsNumber;
  document.querySelector('#lcgeFields').hidden = !lcgeEligible;
  document.querySelector('#spouseIncomeField').hidden = !(spouseShare > 0);

  const inputs = { lcgeEligible, province: form.elements.province.value };
  const invalidFields = [];
  for (const field of fields) {
    field.disabled = Boolean(field.closest('[hidden]'));
    const value = field.value === '' && !field.required ? 0 : field.valueAsNumber;
    const invalid = !field.disabled
      && (!field.validity.valid || !Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER);
    if (invalid) {
      invalidFields.push(field);
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
    if (!field.disabled) inputs[field.id] = value;
  }

  const invalidField = invalidFields[0];
  error.hidden = !invalidField;
  results.hidden = Boolean(invalidField);
  placeholder.hidden = !invalidField;
  if (invalidField) {
    const label = invalidField.labels[0].textContent;
    const max = invalidField.max;
    error.textContent = max
      ? `Enter a value from 0 to ${Number(max).toLocaleString('en-CA')} for ${label}.`
      : `Enter a valid non-negative number for ${label}.`;
    placeholder.textContent = 'Correct the highlighted amount to see your estimate.';
    for (const output of outputs) output.textContent = '';
    return;
  }

  error.textContent = '';
  const estimate = calculateCapitalGains(inputs);
  for (const output of outputs) {
    const key = output.dataset.result;
    const value = estimate[key];
    if (value === null) {
      output.textContent = key === 'spouseSplitSavings' ? 'Not applicable' : '—';
    } else if (key === 'effectiveRate') {
      output.textContent = rate.format(value);
    } else {
      // Avoid displaying negative zero when differences round to cents.
      output.textContent = money.format(Math.abs(value) < 0.005 ? 0 : value);
    }
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();

for (const unit of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(unit.dataset.adSlot)) {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
}
