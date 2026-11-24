import { calculateMovingExpenses, LIMITS } from './model.mjs';

const element = (id) => document.getElementById(id);
const form = element('moving-form');
const results = element('results');
const error = element('error');
const gate = element('gate');
const fields = [...form.querySelectorAll('input, select')];
const conditionalGroups = [...form.querySelectorAll('[data-vehicle], [data-housing]')];
const expenseCells = [...results.querySelectorAll('[data-expense]')];
const totalCells = [
  'grossEligibleExpenses', 'reimbursementApplied', 'totalEligibleExpenses',
  'deductibleThisYear', 'carryForward', 'estimatedTaxSavings',
].map(element);
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const kilometres = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 3 });

function showError(message) {
  error.textContent = message;
  error.hidden = false;
  results.hidden = true;
}

function render() {
  const vehicleMethod = element('vehicleMethod').value;
  const oldHome = element('oldHome').value;
  for (const group of conditionalGroups) {
    const show = group.dataset.vehicle
      ? group.dataset.vehicle === vehicleMethod
      : group.dataset.housing.split(' ').includes(oldHome);
    group.hidden = !show;
    group.querySelector('input, select').disabled = !show;
  }

  const inputs = {};
  for (const field of fields) {
    if (field.disabled) continue;
    if (!field.validity.valid) {
      showError(`${field.labels[0].textContent} — ${field.validationMessage}`);
      return;
    }
    inputs[field.id] = field.type === 'number'
      ? (field.value === '' ? 0 : field.valueAsNumber)
      : field.value;
  }

  let estimate;
  try {
    estimate = calculateMovingExpenses(inputs);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    showError('Check that distances use up to three decimal places and dollar amounts and tax rates use up to two.');
    return;
  }
  gate.dataset.gate = estimate.gate;
  gate.textContent = estimate.gate;
  const distanceDirection = estimate.distanceSaved < 0 ? 'farther' : 'closer';
  const distance = kilometres.format(Math.abs(estimate.distanceSaved));
  element('distance-message').textContent = `· ${distance} km ${distanceDirection} (requires ${LIMITS.distanceKm} km closer)`;
  const cappedDays = estimate.eligibleTemporaryDays;
  element('temporary-status').textContent = inputs.temporaryDays > cappedDays
    ? `Temporary living is capped at ${cappedDays} days. Include only meals and lodging from the eligible period.`
    : '';
  for (const cell of expenseCells) {
    cell.textContent = currency.format(estimate.expenses[cell.dataset.expense]);
  }
  for (const cell of totalCells) {
    cell.textContent = currency.format(estimate[cell.id]);
  }
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
