import { BC_BANDS, MAX_PAYROLL, ONTARIO_CLIFF, comparePayroll } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('payroll-form');
const currentInput = byId('current-payroll');
const addedInput = byId('added-payroll');
const ontarioInput = byId('ontario-employer');
const quebecInput = byId('quebec-employer');
const bcInput = byId('bc-employer');
const results = byId('results');
const error = byId('input-error');
const ranking = byId('ranking');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 3 });

function cell(tag, value, className = '') {
  const element = document.createElement(tag);
  element.textContent = value;
  if (tag === 'th') element.scope = 'row';
  if (className) element.className = className;
  return element;
}

function renderRanking(rows) {
  ranking.replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    tr.append(
      cell('td', row.rank),
      cell('th', row.province),
      cell('td', money.format(row.annualTax), 'amount'),
      cell('td', percent.format(row.effectiveRate / 100), 'amount'),
      cell('td', money.format(row.hiringTax), 'amount')
    );
    return tr;
  }));
}

function savingsText(amount, period) {
  if (amount === 0) return `Same tax ${period}`;
  const direction = amount < 0 ? 'more' : 'less';
  return `${money.format(Math.abs(amount))} ${direction} ${period}`;
}

function ontarioWarning(current, comparison) {
  if (ontarioInput.value === 'charity') return 'The selected Ontario charity keeps its exemption above $5 million.';
  if (ontarioInput.value === 'ineligible') return 'The selected Ontario employer has no exemption to lose.';
  if (current > ONTARIO_CLIFF) return 'Current payroll already exceeds $5 million. The annual estimate applies 1.95% to all Ontario payroll.';
  if (comparison.crossesOntarioCliff) {
    const hiringTax = comparison.rows.find(row => row.code === 'ON').hiringTax;
    return `These hires cross the threshold and add ${money.format(hiringTax)} to Ontario EHT, including the loss of the exemption.`;
  }
  return `Projected payroll has ${money.format(ONTARIO_CLIFF - comparison.projectedPayroll)} of room before it exceeds $5 million.`;
}

function bcWarning(projected) {
  const { exemption, ceiling, rate } = BC_BANDS[bcInput.value];
  const band = `above ${money.format(exemption)} through ${money.format(ceiling)}`;
  const location = bcInput.value === 'nonprofit' ? ' for the qualifying location' : '';
  if (projected < exemption) return `Projected BC payroll is below the exemption${location}. The ${rate}% notch rate applies to payroll ${band}.`;
  if (projected < ceiling) return `Additional payroll${location} within the band (${band}) is subject to the ${rate}% notch rate.`;
  return `Additional BC payroll above ${money.format(ceiling)}${location} is taxed at the 1.95% full rate.`;
}

function render() {
  let message = '';
  for (const input of [currentInput, addedInput]) {
    input.setAttribute('aria-invalid', String(!input.validity.valid));
    if (!input.validity.valid) {
      message = `Enter each payroll amount from $0 to ${money.format(MAX_PAYROLL)} with up to two decimal places.`;
    }
  }

  const current = currentInput.valueAsNumber;
  const added = addedInput.valueAsNumber;
  if (!message && Math.round(current * 100) + Math.round(added * 100) > MAX_PAYROLL * 100) {
    message = `Combined payroll must be ${money.format(MAX_PAYROLL)} or less.`;
    currentInput.setAttribute('aria-invalid', 'true');
    addedInput.setAttribute('aria-invalid', 'true');
  }

  error.textContent = message;
  error.hidden = !message;
  results.hidden = Boolean(message);
  if (message) return;

  const comparison = comparePayroll(current, added, {
    ontario: ontarioInput.value,
    quebec: quebecInput.value,
    bc: bcInput.value
  });
  byId('ranking-summary').textContent = `Projected payroll of ${money.format(comparison.projectedPayroll)} CAD. Ranked from lowest annual tax.`;
  renderRanking(comparison.rows);
  byId('on-hire-savings').textContent = savingsText(comparison.hiringSavings.ON, 'on planned hires');
  byId('ab-hire-savings').textContent = savingsText(comparison.hiringSavings.AB, 'on planned hires');
  byId('on-annual-savings').textContent = savingsText(comparison.annualSavings.ON, 'in total annual tax');
  byId('ab-annual-savings').textContent = savingsText(comparison.annualSavings.AB, 'in total annual tax');
  byId('ontario-warning').textContent = ontarioWarning(current, comparison);
  byId('bc-warning').textContent = bcWarning(comparison.projectedPayroll);
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', event => event.preventDefault());
render();
