import { calculateCRT, STATUS } from './model.mjs';

const form = document.getElementById('crt-inputs');
const results = document.getElementById('crt-results');
const feedback = document.getElementById('feedback');
const risk = document.getElementById('crat-risk');
const money = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 10,
});
const dollars = value => value === null ? '—' : money.format(value);
const scenarios = ['crut', 'crat'];
const dollarRows = [
  'remainderPV', 'upfrontDeduction', 'year1Deduction', 'year1TaxSavings', 'carryforward',
  'immediateTaxDeferred', 'firstPayout', 'totalPayout', 'finalGift',
];
const commonRows = ['gain', 'taxDrag', 'netSaleProceeds', 'outrightFinalBalance'];

function render() {
  const inputs = {};
  for (const input of form.querySelectorAll('input[type="number"]')) {
    inputs[input.name] = input.valueAsNumber / (input.dataset.percent === undefined ? 1 : 100);
    input.removeAttribute('aria-invalid');
  }
  const result = calculateCRT(inputs);
  const invalid = [...form.querySelectorAll('input[type="number"]')].filter(input => !input.validity.valid);
  for (const input of invalid) input.setAttribute('aria-invalid', 'true');

  results.hidden = Boolean(result.error || invalid.length);
  if (results.hidden) {
    if (result.error === STATUS.invalidPayout) {
      feedback.textContent = 'INVALID_PAYOUT_RATE · Enter an annual payout from 5% to 50%.';
    } else if (result.error === STATUS.invalidTerm) {
      feedback.textContent = 'Enter a whole-number term from 1 to 20 years.';
    } else {
      feedback.textContent = 'Check the amount and rate ranges. The combined sale tax rate cannot exceed 100%.';
    }
    return;
  }

  const messages = [];
  for (const type of scenarios) {
    const scenario = result[type];
    const passed = scenario.status === STATUS.pass;
    const status = document.getElementById(type + '-status');
    status.textContent = passed ? 'PASS' : 'FAIL';
    status.dataset.status = scenario.status;
    status.className = passed ? 'pass' : 'fail';
    document.getElementById(type + '-remainderFactor').textContent = percent.format(scenario.remainderFactor);
    for (const field of dollarRows) {
      document.getElementById(type + '-' + field).textContent = dollars(scenario[field]);
    }
    if (!passed) messages.push(type.toUpperCase() + ' fails the 10% remainder test.');
  }
  for (const field of commonRows) document.getElementById(field).textContent = dollars(result[field]);

  const warnings = [];
  if (result.cratExhaustion) {
    warnings.push('At the entered §7520 rate, the fixed annuity uses the entire assumed fund or more. The standard valuation may require a limited-fund adjustment if the last payment cannot be made in full.');
  } else if (result.cratExhaustionWarning) {
    warnings.push('The fixed payout rate exceeds the §7520 rate and the CRAT’s present-value remainder is 5% or less.');
  }
  if (result.crat.firstShortfallYear !== null) {
    warnings.push('At the projected return, the CRAT first falls short of its scheduled payment in year ' + result.crat.firstShortfallYear + '.');
  }
  risk.hidden = warnings.length === 0;
  risk.textContent = warnings.join(' ');
  feedback.textContent = messages.join(' ');
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
