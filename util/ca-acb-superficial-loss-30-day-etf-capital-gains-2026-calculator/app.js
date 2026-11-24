import { calculate, superficialLossWindow } from './model.mjs';

const form = document.querySelector('#calculator');
const events = document.querySelector('#events');
const purchases = document.querySelector('#purchases');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const unitCost = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 6
});
const units = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 8 });
const fields = form.elements;
const windowOutputs = [...document.querySelectorAll('[data-window]')];
const moneyOutputs = [...document.querySelectorAll('[data-money]')];

function addRow(container, template, values) {
  const row = document.querySelector(template).content.firstElementChild.cloneNode(true);
  for (const [name, value] of Object.entries(values)) {
    row.querySelector('[data-field="' + name + '"]').value = value;
  }
  container.append(row);
  return row;
}

function readRow(row) {
  return Object.fromEntries(
    [...row.querySelectorAll('[data-field]')].map(field => [
      field.dataset.field, field.type === 'number' ? field.valueAsNumber : field.value
    ])
  );
}

function updateWindow(saleDate) {
  let window;
  try {
    window = superficialLossWindow(saleDate);
  } catch {
    // Other inputs remain editable when the sale date is incomplete.
  }
  for (const output of windowOutputs) {
    output.textContent = window?.[output.dataset.window] ?? '—';
  }
}

function render() {
  for (const row of events.children) {
    const isBuy = row.querySelector('[data-field="type"]').value === 'buy';
    row.querySelector('[data-buy]').hidden = !isBuy;
    row.querySelector('[data-distribution]').hidden = isBuy;
  }

  const sale = {
    date: fields['sale-date'].value,
    units: fields['sale-units'].valueAsNumber,
    price: fields['sale-price'].valueAsNumber,
    commission: fields['sale-commission'].valueAsNumber
  };
  updateWindow(sale.date);
  const account = fields.account.value;
  const heldAtDay30 = fields.held.valueAsNumber;
  document.querySelector('#replacement-basis').hidden = account !== 'taxable' || heldAtDay30 === 0;

  let estimate;
  try {
    estimate = calculate({
      events: [...events.children].map(readRow),
      sale,
      acquisitions: [...purchases.children].map(readRow),
      heldAtDay30,
      account,
      replacementACB: fields['replacement-acb'].valueAsNumber,
      marginalRate: fields['tax-rate'].valueAsNumber
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  for (const output of moneyOutputs) {
    const key = output.dataset.money;
    const format = key === 'acbPerUnit' ? unitCost : money;
    const value = estimate[key];
    output.textContent = value === null ? 'N/A' : format.format(value);
  }
  document.querySelector('#acquired').textContent = units.format(estimate.unitsAcquired);
  document.querySelector('#tax-label').textContent = estimate.taxEffect < 0 ?
    'Potential tax savings if loss can be used' : 'Estimated tax payable';
  const summary = document.querySelector('#loss-summary');
  if (estimate.permanentLoss > 0) {
    summary.textContent = money.format(estimate.permanentLoss) +
      ' of the loss is permanently denied in this ' + account + ' scenario.';
  } else if (estimate.deferredLoss > 0) {
    summary.textContent = money.format(estimate.deferredLoss) +
      ' of the loss is deferred into the replacement pool’s taxable ACB.';
  } else {
    summary.textContent = 'The entered acquisitions and holdings produce no superficial loss denial.';
  }
}

const addEvent = document.querySelector('#add-event');
const addPurchase = document.querySelector('#add-purchase');
addEvent.addEventListener('click', () => {
  const date = events.lastElementChild?.querySelector('[data-field="date"]').value || fields['sale-date'].value;
  const row = addRow(events, '#event-template', { date });
  row.querySelector('select').focus();
  render();
});
addPurchase.addEventListener('click', () => {
  const row = addRow(purchases, '#purchase-template', { date: fields['sale-date'].value });
  row.querySelector('input').focus();
  render();
});
form.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove]');
  if (!remove) return;
  const row = remove.closest('.row');
  const addButton = row.parentElement === events ? addEvent : addPurchase;
  const focusTarget = row.nextElementSibling?.querySelector('[data-remove]') ??
    row.previousElementSibling?.querySelector('[data-remove]') ?? addButton;
  row.remove();
  focusTarget.focus();
  render();
});
form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());

addRow(events, '#event-template', { date: '2026-02-12', units: 60, price: 25, commission: 9.95 });
addRow(events, '#event-template', { date: '2026-07-09', units: 40, price: 27, commission: 9.95 });
addRow(events, '#event-template', { date: '2026-09-30', type: 'roc', amount: 42 });
addRow(events, '#event-template', { date: '2026-10-13', type: 'phantom', amount: 31.50 });
addRow(purchases, '#purchase-template', { date: '2026-11-27', units: 60 });
form.hidden = false;
render();
