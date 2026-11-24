import { calculateContributions } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('contribution-form');
const entity = byId('entity');
const catchUpMode = byId('catchUpMode');
const status = byId('status');
const results = byId('results');
const rothNote = byId('roth-note');
const entityFields = form.querySelectorAll('[data-entity]');
const numericInputs = form.querySelectorAll('input[type="number"]');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function writeMoney(id, value) {
  byId(id).textContent = usd.format(value);
}

function render() {
  const isSole = entity.value === 'sole-proprietor';
  const inputs = { entity: entity.value, catchUpMode: catchUpMode.value };
  for (const group of entityFields) {
    const active = group.dataset.entity === entity.value;
    group.hidden = !active;
    group.querySelector('input').disabled = !active;
  }

  let invalidInput;
  for (const input of numericInputs) {
    const invalid = !input.disabled && !input.validity.valid;
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
      invalidInput ??= input;
    } else {
      input.removeAttribute('aria-invalid');
    }
    if (!input.disabled) inputs[input.id] = input.valueAsNumber;
  }

  if (invalidInput) {
    const label = invalidInput.labels[0].textContent;
    status.textContent = `${label}. ${invalidInput.validationMessage}`;
    results.hidden = true;
    return;
  }

  const estimate = calculateContributions(inputs);
  const contributions = {
    'solo-max': estimate.soloMax,
    'sep-max': estimate.sepMax,
    'extra-room': estimate.extraRoom,
    'after-tax-room': estimate.afterTaxRoom,
    'solo-with-after-tax': estimate.soloMaxWithAfterTax,
    'employee': estimate.employeeDeferral,
    'employer': estimate.employerContribution,
    'catch-up': estimate.catchUp,
    'annual-limit': estimate.annualAdditionsLimit,
    'adjusted-se': estimate.adjustedNetSE
  };
  for (const [id, value] of Object.entries(contributions)) writeMoney(id, value);

  for (const [plan, savings] of [['solo', estimate.soloTaxSavings], ['sep', estimate.sepTaxSavings]]) {
    for (const [tax, value] of Object.entries(savings)) writeMoney(`${plan}-${tax}`, value);
  }

  byId('adjusted-se-row').hidden = !isSole;
  byId('catch-up-type').textContent = estimate.catchUp > 0
    ? estimate.rothCatchUp ? '(Roth)' : '(pre-tax estimate)'
    : '';

  rothNote.hidden = !estimate.rothCatchUp;
  if (estimate.rothCatchUp) {
    rothNote.textContent = 'Your 2025 sponsor wages exceed $150,000. Any 2026 catch-up in this plan must be Roth, so it adds no current-year tax savings.';
    if (catchUpMode.value === 'pre-tax-only') {
      rothNote.textContent += ' Your selected plan offers only pre-tax catch-up, so the estimate allows $0 in catch-up.';
    }
  }

  status.textContent = '';
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('change', event => {
  if (event.target instanceof HTMLSelectElement) render();
});
render();

for (const slot of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(slot.dataset.adSlot)) (window.adsbygoogle ??= []).push({});
}
