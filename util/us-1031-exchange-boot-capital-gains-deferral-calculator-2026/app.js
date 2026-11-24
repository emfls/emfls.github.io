import { calculateDeadlines, calculateExchange, moneyFields } from './model.mjs';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
});
const form = document.querySelector('#exchange-form');
const financialResults = document.querySelector('#financial-results');
const deadlineResults = document.querySelector('#deadline-results');
const field = name => form.elements.namedItem(name);

function render(section, values, format) {
  for (const output of section.querySelectorAll('[data-value]')) {
    output.textContent = values ? format(values[output.dataset.value]) : '—';
  }
}

function updateFinancials() {
  const error = document.querySelector('#financial-error');
  const fundingWarning = document.querySelector('#funding-warning');
  const amounts = Object.fromEntries(moneyFields.map(key => [key, field(key).valueAsNumber]));
  const stateRate = field('stateRate').valueAsNumber;

  error.textContent = '';
  fundingWarning.textContent = '';
  try {
    const result = calculateExchange({
      ...amounts, stateRate, ltcgRate: Number(field('ltcgRate').value), niit: field('niit').checked
    });
    render(financialResults, result, value => money.format(value));
    const warnings = [];
    if (result.fundingGap !== 0) {
      const direction = result.fundingGap > 0 ? 'shortfall' : 'surplus';
      warnings.push(`Replacement equity shows a ${money.format(Math.abs(result.fundingGap))} funding ${direction}. Reconcile cash kept, cash added, both loans and the replacement price before relying on the basis or tax estimate.`);
    }
    if (result.realizedLoss > 0) {
      warnings.push(`Net sale proceeds are ${money.format(result.realizedLoss)} below adjusted basis. The gain-only basis estimate does not account for a deferred loss.`);
    }
    if (result.carryoverBasis < 0) warnings.push('Negative estimated basis indicates inputs outside the model’s assumptions.');
    fundingWarning.textContent = warnings.join(' ');
  } catch (issue) {
    render(financialResults, null);
    error.textContent = issue.message;
  }
}

function updateDeadlines() {
  const error = document.querySelector('#date-error');
  const note = document.querySelector('#deadline-note');
  const due = field('returnDueDate');

  error.textContent = '';
  note.textContent = '';
  try {
    if (due.validity.badInput) throw new RangeError('Enter a complete federal return due date.');
    const deadlines = calculateDeadlines(field('closingDate').value, due.value);
    render(deadlineResults, deadlines, value => date.format(new Date(`${value}T00:00:00Z`)));
    if (!due.value) note.textContent = 'Enter your federal return due date to check whether it shortens the exchange window.';
    else if (deadlines.exchangeDeadline < deadlines.day180Deadline) note.textContent = 'Your federal return due date shortens the exchange window.';
  } catch (issue) {
    render(deadlineResults, null);
    error.textContent = issue.message;
  }
}

function update() {
  updateFinancials();
  updateDeadlines();
}

form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('reset', () => queueMicrotask(update));
update();

// Display units must use slot IDs issued under the configured publisher.
for (const slot of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(slot.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
