import { calculate } from './model.mjs';

const form = document.getElementById('calculator');
const fields = [...form.querySelectorAll('input, select')];
const error = document.getElementById('error');
const results = document.getElementById('results');
const resultNote = document.getElementById('result-note');
const metrics = document.getElementById('metrics');
const bridge = document.getElementById('bridge');
const schedule = document.getElementById('schedule-panel');
const scheduleRows = document.getElementById('schedule-rows');
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol',
});
const money = value => value === null ? 'N/A' : currency.format(Math.round(value * 100) / 100 || 0);

function readInput() {
  return Object.fromEntries(fields.map(field => {
    if (!field.validity.valid) {
      throw new RangeError(field.labels[0].textContent.trim() + ' — ' + field.validationMessage);
    }
    if (field.type === 'checkbox') return [field.id, field.checked];
    return [field.id, field.type === 'number' ? field.valueAsNumber : field.value];
  }));
}

function renderMetrics(estimate) {
  const entries = [
    ['Net after-CGT tax benefit', estimate.netTaxBenefit],
    ['Net benefit with reinvestment', estimate.saleValueBenefit],
    ['Year-one deduction', estimate.yearOne],
    ['Total holding-period deduction', estimate.totalDeductions],
    ['Division 43 deductions', estimate.totalDiv43],
    ['Division 40 deductions', estimate.totalDiv40],
    ['Estimated tax savings during ownership', estimate.taxSavings],
    ['Extra CGT from Division 43', estimate.extraCgt],
    ['Adjusted property cost base', estimate.adjustedCostBase],
    ['Growth from reinvesting tax savings', estimate.reinvestmentGrowth],
  ];
  metrics.replaceChildren(...entries.map(([label, value], index) => {
    const group = document.createElement('div');
    group.className = index < 2 ? 'metric primary' : 'metric';
    const term = document.createElement('dt');
    term.textContent = label;
    const amount = document.createElement('dd');
    amount.textContent = money(value);
    group.append(term, amount);
    return group;
  }));
}

function renderSchedule(rows) {
  scheduleRows.replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = row.year + '–' + String(row.year + 1).slice(-2);
    tr.append(year);
    const amounts = [row.div43, row.div40, row.deduction, row.plantClosing, row.taxSaving, row.grownSaving];
    for (const content of [row.rentalDays, ...amounts.map(money)]) {
      tr.insertCell().textContent = content;
    }
    return tr;
  }));
}

function render() {
  let input;
  let estimate;
  try {
    input = readInput();
    estimate = calculate(input);
  } catch (problem) {
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    schedule.hidden = true;
    return;
  }
  error.hidden = true;
  const notes = [];
  if (estimate.cgtInScope) {
    notes.push(estimate.discountApplied ? 'The 50% CGT discount applies in this scenario.' : 'This scenario uses the full taxable gain.');
    bridge.textContent = 'The taxable property gain moves from ' + money(estimate.taxableGainBefore)
      + ' to ' + money(estimate.taxableGainAfter) + ' after the cost-base adjustment. Division 43 alone yields '
      + money(estimate.netWorksBenefit) + ' of net tax benefit before reinvestment.';
  } else {
    notes.push('Sale CGT and net after-CGT figures are available for 2026–27 contracts. Later sales can be subject to CGT reform, and deduction usability may change.');
    bridge.textContent = '';
  }
  if (!estimate.worksEligible) notes.push('The construction start date is outside the modelled 2.5% regime.');
  if (input.restrictedPlant) notes.push('The restriction blocks annual deductions for this plant. Any separate disposal gain or loss remains outside the estimate.');
  resultNote.textContent = notes.join(' ');
  renderMetrics(estimate);
  renderSchedule(estimate.rows);
  results.hidden = false;
  schedule.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
