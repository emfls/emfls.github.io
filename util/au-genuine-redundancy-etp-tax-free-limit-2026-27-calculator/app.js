import { calculatePayout } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const error = byId('error');
const ageInput = byId('age');
const genuineInput = byId('genuine');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent' });
const currencyOutputs = [...results.querySelectorAll('output')];

function update() {
  const age = ageInput.valueAsNumber;
  const genuine = genuineInput.checked;
  byId('birthday-option').hidden = age !== 59;
  byId('notice-option').hidden = !genuine;

  let payout;
  try {
    payout = calculatePayout({
      years: byId('years').valueAsNumber,
      age,
      reaches60: byId('reaches60').checked,
      genuine,
      severance: byId('severance').valueAsNumber,
      notice: byId('notice').valueAsNumber,
      qualifyingNotice: byId('qualifyingNotice').checked,
      leave: byId('leave').valueAsNumber,
      priorIncome: byId('priorIncome').valueAsNumber,
    });
  } catch (eventError) {
    if (!(eventError instanceof RangeError)) throw eventError;
    error.textContent = eventError.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  for (const output of currencyOutputs) {
    output.value = money.format(payout[output.id]);
  }
  byId('concessional-rate').textContent = percent.format(payout.etpRate);
  byId('leave-label').textContent = payout.eligible ? 'Unused leave tax (32%)' : 'Estimated unused leave tax';
  const notes = [];
  if (!payout.eligible) notes.push('The tax-free redundancy limit does not apply to these inputs.');
  if (payout.otherEtp > 0) {
    notes.push(`${money.format(payout.otherEtp)} is a non-excluded ETP, with ${money.format(payout.otherEtpCap)} of concessional cap available.`);
  }
  byId('classification').textContent = notes.join(' ');
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
