import { calculateCatchUp } from './model.mjs';

const form = document.getElementById('catch-up-form');
const wages = form.elements.wages;
const results = document.getElementById('results');
const error = document.getElementById('error');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (amount) => currency.format(Math.abs(amount) < 0.005 ? 0 : amount);

function show(id, value) {
  document.getElementById(id).textContent = value;
}

function update() {
  const employment = form.elements.employment.value;
  wages.disabled = employment !== 'same';

  if (!form.checkValidity()) {
    const field = form.querySelector(':invalid');
    error.textContent = `${field.labels[0].textContent}. ${field.validationMessage}`;
    results.hidden = true;
    return;
  }

  const inputs = Object.fromEntries(new FormData(form));
  for (const field of form.querySelectorAll('input[type="number"]:enabled')) {
    inputs[field.name] = field.valueAsNumber;
  }
  inputs.payPeriods = Number(inputs.payPeriods);

  const estimate = calculateCatchUp(inputs);
  const verdictNote = estimate.catchUpLimit === 0
    ? 'Age-based catch-up starts at age 50 at year-end.'
    : `${money(estimate.employerWages)} in applicable 2025 wages. ${estimate.mandatoryRoth
      ? 'Any eligible catch-up must go to Roth.'
      : 'Tax treatment depends on the options your plan offers.'}`;
  show('verdict', estimate.verdict);
  show('verdict-note', verdictNote);
  show('employee-max', money(estimate.maxEmployee));
  show('limit-detail', `${money(estimate.catchUpLimit)} catch-up limit · ${money(estimate.maxWithEmployer)} 401(k) ceiling including employer contributions`);
  show('tax-difference', money(estimate.taxDifference));
  show('paycheck-change', money(estimate.paycheckChange));
  show('applied', `${money(estimate.appliedTotal)} modeled: ${money(estimate.appliedBase)} regular deferral + ${money(estimate.appliedCatchUp)} catch-up.`);
  const notes = [];
  if (estimate.reclassified) notes.push('The model fills the regular deferral limit first and recalculates the catch-up portion.');
  if (estimate.excess > 0) notes.push(`${money(estimate.excess)} above the employee limit was excluded.`);
  show('allocation-note', notes.join(' '));
  show('roth-value', money(estimate.rothValue));
  show('pretax-value', money(estimate.pretaxTotalValue));
  show('pretax-detail', `Includes ${money(estimate.netTaxSavingsValue)} from investing the tax savings.`);
  show('winner', estimate.winner);
  show('wealth-detail', estimate.wealthDifference === 0 ? '' : `${money(Math.abs(estimate.wealthDifference))} more at retirement in this scenario.`);
  show('comparison-note', estimate.mandatoryRoth
    ? 'The pre-tax catch-up case is hypothetical for this wage and age combination.'
    : 'Both estimates use the same catch-up dollars and a qualified Roth distribution.');
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
