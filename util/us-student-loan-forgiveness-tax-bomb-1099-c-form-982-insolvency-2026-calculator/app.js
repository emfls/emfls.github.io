import { calculateForgivenessTax } from './model.mjs';

const form = document.getElementById('forgiveness-form');
const program = form.elements.namedItem('program');
const filingStatus = form.elements.namedItem('filingStatus');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const resultPanel = document.getElementById('results');
const error = document.getElementById('form-error');
const tpdNote = document.getElementById('tpd-note');
const savingsNote = document.getElementById('savings-note');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function updateEstimate() {
  tpdNote.hidden = program.value !== 'tpd_tax_free';
  program.setAttribute('aria-describedby', tpdNote.hidden ? '' : tpdNote.id);
  const values = Object.fromEntries(inputs.map(input => [input.id, input.valueAsNumber]));

  try {
    const invalidInput = inputs.find(input => !input.validity.valid);
    if (invalidInput) {
      const field = invalidInput.labels[0].textContent;
      throw new RangeError(`${field} — ${invalidInput.validationMessage}`);
    }
    const estimate = calculateForgivenessTax({
      ...values,
      program: program.value,
      filingStatus: filingStatus.value,
    });
    for (const [field, value] of Object.entries(estimate)) {
      document.getElementById(field).textContent = value === null ? 'Reserve now' : money.format(value);
    }
    savingsNote.textContent = estimate.monthlySavings === null
      ? `Set aside ${money.format(estimate.totalTax)} for the estimated tax. The entered timeline has less than one full saving month.`
      : 'The monthly target uses full months remaining, assumes no interest, and rounds up to the next cent when needed.';
    error.hidden = true;
    error.textContent = '';
    resultPanel.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    resultPanel.hidden = true;
    error.hidden = false;
    error.textContent = failure.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', updateEstimate);
updateEstimate();
