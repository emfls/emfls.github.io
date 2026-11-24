import { calculateSection179 } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const useAlert = document.querySelector('#business-use-alert');
const lossNote = document.querySelector('#loss-note');
const fields = [...form.querySelectorAll('input, select')];
const outputs = [...results.querySelectorAll('[data-result]')];
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function render() {
  const invalidField = fields.find(field => !field.validity.valid);
  if (invalidField) {
    error.textContent = `${invalidField.labels[0].textContent} — ${invalidField.validationMessage}`;
    results.hidden = true;
    return;
  }

  const inputs = Object.fromEntries(fields.map(field => [
    field.name,
    field.type === 'number' ? field.valueAsNumber : field.name === 'bonusRate' ? Number(field.value) : field.value,
  ]));
  const estimate = calculateSection179(inputs);
  for (const output of outputs) {
    output.textContent = dollars.format(estimate[output.dataset.result]);
  }

  useAlert.hidden = !estimate.lowBusinessUse;
  useAlert.textContent = inputs.assetType === 'general_equipment_software'
    ? 'At 50% business use or less, Section 179 is unavailable. Eligible non-listed equipment or software can still qualify for bonus depreciation on its business basis.'
    : 'At 50% qualified business use or less, the listed-vehicle scenario loses both Section 179 and bonus depreciation. Any depreciable business basis generally uses straight-line ADS.';
  lossNote.hidden = estimate.deductionBeyondIncome === 0;
  lossNote.textContent = `${dollars.format(estimate.deductionBeyondIncome)} of the modeled write-off exceeds your entered positive income. It may contribute to a net operating loss or offset other eligible income. The cash estimate assigns no value to that portion.`;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
