import { calculatePtt, FIRST_TIME, NEW_BUILD } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('ptt-form');
const price = byId('price');
const program = byId('program');
const eligibleShare = byId('eligible-share');
const foreignTax = byId('foreign-tax');
const foreignShare = byId('foreign-share');
const results = byId('results');
const error = byId('input-error');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percentage = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const wholeMoney = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

function thresholdMessage(stage) {
  if (stage === 'none') return 'Select a program to see where your estimate falls within its exemption thresholds.';

  const rules = program.value === 'first-time' ? FIRST_TIME : NEW_BUILD;
  const start = wholeMoney.format(rules.fullThrough);
  const end = wholeMoney.format(rules.endsAt);
  if (stage === 'ended') return `This value is at or above ${end}, where the selected exemption ends.`;
  if (stage === 'partial') return `This value is in the phase-out range. The selected exemption reaches zero at ${end}.`;
  return `This value is within the full benefit range. Savings begin to decline above ${start} and end at ${end}.`;
}

function render() {
  eligibleShare.disabled = program.value === 'none';
  byId('eligible-field').hidden = eligibleShare.disabled;
  foreignShare.disabled = !foreignTax.checked;
  byId('foreign-field').hidden = foreignShare.disabled;

  let estimate;
  try {
    estimate = calculatePtt({
      price: price.valueAsNumber,
      program: program.value,
      eligibleBuyerOwnershipPct: eligibleShare.valueAsNumber,
      foreignBuyerTax: foreignTax.checked,
      foreignBuyerOwnershipPct: foreignShare.valueAsNumber,
    });
  } catch (invalidInput) {
    results.hidden = true;
    error.textContent = invalidInput.message;
    byId('threshold-status').textContent = '';
    return;
  }

  error.textContent = '';
  results.hidden = false;
  byId('standard-ptt').textContent = money.format(estimate.standardPtt);
  byId('exemption-saved').textContent = money.format(estimate.exemptionSaved);
  byId('foreign-ptt').textContent = money.format(estimate.foreignTax);
  byId('closing-ptt').textContent = money.format(estimate.totalDue);
  byId('effective-rate').textContent = percentage.format(estimate.effectiveRate / 100);
  byId('threshold-status').textContent = thresholdMessage(estimate.stage);
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
