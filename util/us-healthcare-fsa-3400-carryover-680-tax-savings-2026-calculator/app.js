import { calculateFsa } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('fsa-form');
const employeeCount = get('employee-count');
const results = get('results');
const error = get('error');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = (value) => currency.format(value);
const set = (id, value) => { get(id).textContent = value; };

const employees = [1, 2].map((number) => {
  const fragment = get('employee-template').content.cloneNode(true);
  const fieldset = fragment.querySelector('fieldset');
  const fields = Object.fromEntries([...fieldset.querySelectorAll('[data-field]')].map((input) => [
    input.dataset.field, input,
  ]));
  fieldset.querySelector('legend').textContent = `Employee ${number}`;
  for (const label of fieldset.querySelectorAll('[data-for]')) {
    const name = label.dataset.for;
    fields[name].id = `employee-${number}-${name}`;
    label.htmlFor = fields[name].id;
  }

  if (number === 2) {
    fields.election.value = '1500';
    fields.expenses.value = '1200';
    fields.plan.value = 'strict';
  }
  get('employees').append(fragment);
  return { fieldset, fields };
});

function readEmployee({ fieldset, fields }) {
  for (const group of fieldset.querySelectorAll('[data-plan]')) {
    group.hidden = group.dataset.plan !== fields.plan.value;
    group.querySelector('input').disabled = group.hidden;
  }

  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [
    name, field.type === 'number' ? field.valueAsNumber
      : name === 'ficaRate' ? Number(field.value) : field.value,
  ]));
}

function render() {
  const active = employees.slice(0, Number(employeeCount.value));
  employees[1].fieldset.hidden = active.length === 1;
  employees[1].fieldset.disabled = active.length === 1;
  const inputs = active.map(readEmployee);
  const invalid = form.querySelector('input:invalid');

  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = `${invalid.closest('fieldset').querySelector('legend').textContent} · ${label}: ${invalid.validationMessage}`;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const estimate = calculateFsa(inputs);
  error.hidden = true;
  results.hidden = false;
  set('tax-savings', money(estimate.taxSavings));
  set('effective-discount', estimate.effectiveDiscount === null ? '—' : `${percent.format(estimate.effectiveDiscount)}%`);
  set('forfeiture-risk', money(estimate.forfeitureRisk));
  set('safe-election', money(estimate.safeElection));
  set('break-even', money(estimate.breakEvenForfeiture));
  set('net-savings', money(estimate.netSavings));
  get('net-savings').dataset.loss = estimate.netSavings < 0;
  get('hsa-alert').hidden = !estimate.hsaConflict;

  set('tax-breakdown', `Federal ${money(estimate.federalSavings)} · State ${money(estimate.stateSavings)} · FICA ${money(estimate.ficaSavings)}`);
  const split = estimate.safeElections.length === 2
    ? ` Suggested split: ${money(estimate.safeElections[0])} for employee 1 and ${money(estimate.safeElections[1])} for employee 2.`
    : '';
  set('interpretation', `Of ${money(estimate.unusedAtYearEnd)} projected unused at year-end, ${money(estimate.carryover)} can carry over and ${money(estimate.graceUsed)} is projected to be spent during a grace period.${split}`);

  const carryoverStress = estimate.carryover
    ? ` If none of the carryover is used, net savings fall to ${money(estimate.netSavingsIfCarryoverExpires)}.`
    : '';
  set('loss-warning', `Forfeiting exactly ${money(estimate.breakEvenForfeiture)} breaks even. Forfeiting more costs you money.${carryoverStress}`);
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
