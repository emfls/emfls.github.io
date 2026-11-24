import { calculateHelp, PROJECTION_YEARS } from './model.mjs';

const form = document.querySelector('#help-form');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const fields = [...form.querySelectorAll('input')];
const scheduleBody = document.querySelector('#schedule-body');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const wholeMoney = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 0,
});

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function payoffLabel(years) {
  if (years === null) return `Beyond ${PROJECTION_YEARS} years`;
  if (years === 0) return 'No annual repayments needed';
  return years === 1 ? '1 year' : `${years} years`;
}

function render() {
  const invalid = fields.find((field) => !field.validity.valid);
  for (const field of fields) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }
  results.hidden = Boolean(invalid);
  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = `${label} — ${invalid.validationMessage}`;
    return;
  }

  error.textContent = '';
  const options = Object.fromEntries(fields.map((field) => [field.name, field.valueAsNumber || 0]));
  const result = calculateHelp(options);
  text('annual-result', money.format(result.annual));
  text('repayment-income-result', wholeMoney.format(result.income));
  text('monthly-result', money.format(result.monthly));
  text('fortnightly-result', money.format(result.fortnightly));
  text('weekly-result', money.format(result.weekly));
  text('effective-rate-result', `${result.effectiveRate.toFixed(2)}%`);
  text('income-formula-result', money.format(result.incomeBasedRepayment));
  text('historical-result', money.format(result.historicalRepayment));
  text('savings-result', money.format(result.historicalSavings));
  text('payoff-result', payoffLabel(result.yearsToPayoff));
  text('baseline-result', payoffLabel(result.yearsWithoutVoluntary));
  text('indexation-result', money.format(result.indexationAvoided));

  document.querySelector('#schedule').hidden = result.schedule.length === 0;
  scheduleBody.replaceChildren(...result.schedule.map((entry) => {
    const row = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = `${entry.year}–${String(entry.year + 1).slice(-2)}`;
    row.append(year);
    for (const value of [wholeMoney.format(entry.income), ...[
      entry.openingBalance, entry.voluntaryPayment, entry.indexation, entry.repayment, entry.closingBalance,
    ].map((amount) => money.format(amount))]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
