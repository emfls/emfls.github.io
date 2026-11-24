import { calculateIht } from './model.mjs';

const form = document.getElementById('iht-form');
const fields = [...form.querySelectorAll('input[type="number"]')];
const results = document.getElementById('results');
const outputs = [...results.querySelectorAll('[data-result]')];
const taperNote = document.getElementById('taper-note');
const status = document.getElementById('calculation-status');
const error = document.getElementById('input-error');
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function render() {
  for (const field of fields) {
    field.setAttribute('aria-invalid', String(!field.validity.valid));
  }

  const invalid = fields.find(field => !field.validity.valid);
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent} must be between £0 and ${pounds.format(Number(invalid.max))}, with up to two decimal places.`;
    error.hidden = false;
    results.hidden = true;
    status.textContent = '';
    return;
  }

  const result = calculateIht({
    householdMode: form.elements.householdMode.value,
    ...Object.fromEntries(fields.map(field => [field.name, field.valueAsNumber]))
  });

  error.hidden = true;
  for (const output of outputs) {
    output.textContent = pounds.format(result[output.dataset.result]);
  }
  taperNote.hidden = result.rnrbLost === 0;
  taperNote.textContent = `The estate exceeds £2 million before asset reliefs. The taper reduces the entered residence nil-rate band by ${pounds.format(result.rnrbLost)}.`;
  results.hidden = false;
  status.textContent = `Estimated inheritance tax ${pounds.format(result.totalIhtDue)}. Annual instalment ${pounds.format(result.annualInstalment)}.`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
