import { calculateCredits } from './model.mjs';

const form = document.querySelector('#renovation-form');
const individual = document.querySelector('#individual');
const individualNote = document.querySelector('#individual-note');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const error = document.querySelector('#input-error');
const results = document.querySelector('#estimate');
const split = document.querySelector('#split');
const amounts = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

function render() {
  individualNote.textContent = individual.value === 'senior'
    ? 'Use this option if the person is 65 or older by the end of 2026.'
    : 'Use this option if the person is at least 18 by year-end and eligible for the disability tax credit for 2026.';

  const medical = form.elements.medicalEligible;
  const accessibility = form.elements.accessibilityCost;
  medical.setCustomValidity('');
  if (medical.valueAsNumber > accessibility.valueAsNumber) {
    medical.setCustomValidity('Enter a medical-eligible portion within the separate accessibility cost.');
  }

  for (const input of inputs) {
    if (input.validity.valid) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
  }
  const invalid = inputs.find((input) => !input.validity.valid);
  if (invalid) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = `${invalid.labels[0].textContent} — ${invalid.validationMessage}`;
    return;
  }

  const values = Object.fromEntries(inputs.map((input) => [input.name, input.valueAsNumber]));
  let estimate;
  try {
    estimate = calculateCredits({ individual: individual.value, ...values });
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    results.hidden = true;
    error.hidden = false;
    error.textContent = failure.message;
    return;
  }
  for (const output of results.querySelectorAll('[data-amount]')) {
    output.textContent = amounts.format(estimate[output.dataset.amount]);
  }

  split.textContent = estimate.medicalClaim > 0
    ? 'Use separate eligible accessibility expenses for HATC and METC. Match this split to documented invoice items.'
    : 'Use separate suite and accessibility expenses. The medical-eligible portion adds no federal savings under this estimate.';
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
