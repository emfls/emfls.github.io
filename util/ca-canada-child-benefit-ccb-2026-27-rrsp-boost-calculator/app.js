import { calculateDeductionImpact } from './model.mjs';

const form = document.querySelector('#ccb-form');
const fields = [...form.querySelectorAll('input')];
const results = document.querySelector('#ccb-results');
const error = document.querySelector('#ccb-error');
const summary = document.querySelector('#ccb-summary');
const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });

function render() {
  const invalid = fields.filter((field) => !field.validity.valid);
  for (const field of fields) {
    if (field.validity.valid) {
      field.removeAttribute('aria-invalid');
    } else {
      field.setAttribute('aria-invalid', 'true');
    }
  }

  results.hidden = invalid.length > 0;
  if (invalid.length) {
    const field = invalid[0];
    error.textContent = `${field.labels[0].textContent}: ${field.validationMessage}`;
    error.hidden = false;
    summary.textContent = '';
    return;
  }
  error.hidden = true;
  error.textContent = '';

  const values = Object.fromEntries(fields.map((field) => [field.name, field.valueAsNumber]));
  const { before, after, annualBoost, taxSavings, combinedSavings, effectiveReturn } = calculateDeductionImpact(values);
  const amounts = {
    'afni-before': before.afni,
    'afni-after': after.afni,
    'annual-before': before.annual,
    'annual-after': after.annual,
    'monthly-before': before.monthly,
    'monthly-after': after.monthly,
    'ccb-boost': annualBoost,
    'tax-savings': taxSavings,
    'combined-savings': combinedSavings,
  };
  for (const [id, amount] of Object.entries(amounts)) {
    document.getElementById(id).textContent = dollars.format(amount);
  }
  const returnLabel = effectiveReturn === null ? 'N/A' : percent.format(effectiveReturn / 100);
  document.querySelector('#effective-return').textContent = returnLabel;
  summary.textContent = `Estimated annual CCB after deduction: ${dollars.format(after.annual)}. Extra CCB: ${dollars.format(annualBoost)}. Combined savings rate: ${returnLabel}.`;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
