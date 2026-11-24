import {parseCents, simulatePlan} from './model.mjs';

const money = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'});
const currency = pence => money.format(pence / 100);
const percent = bps => (bps / 100).toFixed(2) + '%';
const yearLabel = year => year + '/' + String(year + 1).slice(-2);

export function summarize(form) {
  const cents = name => parseCents(form.get(name));
  const inputs = {
    balance: cents('balance'), salary: cents('salary'), salaryGrowthBps: cents('salaryGrowth'),
    thresholdGrowthBps: cents('thresholdGrowth'), rpiBps: cents('rpi'), cap: form.has('cap'),
  };
  const plans = [2, 5].map(plan => ({
    plan, ...simulatePlan({...inputs, plan, yearsRemaining: Number(form.get('years' + plan))}),
  }));
  const [plan2, plan5] = plans;
  const delta = plan5.totalPaid - plan2.totalPaid;
  const rows = [
    ['Plan 5 minus Plan 2 scheduled repayment in year 1', currency(plan5.scheduledAnnual - plan2.scheduledAnnual)],
    ['Lower lifetime repayment in this scenario',
      delta ? 'Plan ' + (delta > 0 ? '2' : '5') + ' by ' + currency(Math.abs(delta)) : 'Same under both plans'],
  ];
  for (const r of plans) {
    const label = 'Plan ' + r.plan;
    rows.push(
      [label + ' scheduled annual / monthly repayment', currency(r.scheduledAnnual) + ' / ' + currency(r.scheduledMonthly)],
      [label + ' year-one payment after balance limit', currency(r.actualYearOnePaid)],
      [label + ' year-one interest estimate', percent(r.yearOneRate)],
      [label + ' marginal deduction rate at this salary', r.marginalRate + '%'],
      [label + ' total repaid', currency(r.totalPaid)],
      [label + ' outcome', r.cleared ? 'Cleared in full' : currency(r.writtenOff) + ' written off'],
    );
  }
  return {rows, tables: plans.map(({plan, rows: years}) => ({
    title: 'Plan ' + plan + ' annual projection',
    headers: ['Tax year', 'Salary', 'Threshold', 'Interest rate', 'Interest added', 'Repaid', 'Closing balance before write-off'],
    data: years.map(row => [
      yearLabel(row.year), currency(row.salary), currency(row.threshold), percent(row.rate),
      currency(row.interest), currency(row.paid), currency(row.balance),
    ]),
  }))};
}

function renderTable({title, headers, data}) {
  const box = document.createElement('div');
  box.className = 'table-wrap';
  box.tabIndex = 0;
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', title);
  const table = document.createElement('table');
  table.createCaption().textContent = title;
  const header = table.createTHead().insertRow();
  for (const label of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of data) {
    const tr = body.insertRow();
    for (const value of row) tr.insertCell().textContent = value;
  }
  if (!data.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = headers.length;
    cell.textContent = 'No repayment years remaining.';
  }
  box.append(table);
  return box;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const schedules = document.querySelector('#schedules');
  const hint = result.textContent.trim();
  form.addEventListener('input', () => {
    result.textContent = hint;
    schedules.replaceChildren();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const {rows, tables} = summarize(new FormData(form));
      const list = document.createElement('dl');
      for (const [label, value] of rows) {
        const term = document.createElement('dt');
        const definition = document.createElement('dd');
        term.textContent = label;
        definition.textContent = value;
        list.append(term, definition);
      }
      result.replaceChildren(list);
      schedules.replaceChildren(...tables.map(renderTable));
    } catch (error) {
      result.textContent = error instanceof RangeError ? error.message : 'Check the inputs and try again.';
      schedules.replaceChildren();
    }
  });
  form.querySelector('button[type=submit]').disabled = false;
}
