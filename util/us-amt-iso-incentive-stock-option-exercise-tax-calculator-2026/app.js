import { calculateIsoAmt } from './model.mjs';

const form = document.getElementById('iso-form');
const field = id => form.elements.namedItem(id);
const itemizedFields = document.getElementById('itemized-fields');
const results = document.getElementById('results');
const error = document.getElementById('error');
const breakdown = document.getElementById('mfs-row');
const crossoverNote = document.getElementById('crossover-note');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const preciseCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 });
const integers = new Intl.NumberFormat('en-US');
const money = amount => (amount !== 0 && Math.abs(amount) < 0.01 ? preciseCurrency : currency).format(amount);

function render() {
  const itemized = field('deduction').value === 'itemized';
  itemizedFields.hidden = !itemized;
  field('itemizedDeductions').disabled = !itemized;
  field('salt').disabled = !itemized;

  const inputs = { status: field('status').value, deduction: field('deduction').value };
  for (const input of form.querySelectorAll('input:not(:disabled)')) {
    inputs[input.id] = input.valueAsNumber;
  }

  let estimate;
  try {
    estimate = calculateIsoAmt(inputs);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  for (const [key, value] of Object.entries(estimate)) {
    const output = document.getElementById(key);
    if (!output) continue;
    if (key === 'maxIsoShares') output.textContent = value === null ? 'No AMT limit' : integers.format(value);
    else output.textContent = value === null ? 'Unavailable' : money(value);
  }

  if (estimate.maxIsoSpread === null) {
    crossoverNote.textContent = `Your baseline AMT is ${money(estimate.baselineAmt)} before this exercise.`;
  } else if (estimate.isoSpreadPerShare === 0) {
    crossoverNote.textContent = 'The entered exercise price equals or exceeds fair market value, so each share adds $0 of spread.';
  } else {
    crossoverNote.textContent = `Based on ${money(estimate.isoSpreadPerShare)} of spread per share. The cutoff uses unrounded tax and whole cents of spread.`;
  }
  breakdown.hidden = inputs.status !== 'mfs';
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();

for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(slot.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
