import { calculate } from './model.mjs';

const form = document.getElementById('calculator');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const results = document.getElementById('results');
const error = document.getElementById('input-error');
const announcement = document.getElementById('announcement');
const quarters = document.getElementById('quarters');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const dates = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });
const amountIds = [
  'monthlySaving', 'january', 'july', 'annualMonthlySaving', 'currentGross',
  'tradeProfit', 'rentProfit', 'allowance', 'incomeTax', 'class4', 'class2',
  'balance', 'accountCredit'
];

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function dateElement(isoDate) {
  const date = document.createElement('time');
  date.dateTime = isoDate;
  date.textContent = dates.format(new Date(isoDate));
  return date;
}

function renderCalendar({ startYear, quarterlyDates, finalReturnDate }) {
  const status = startYear === null
    ? 'Your figures are within the income exemptions for all three rollout phases shown.'
    : `Estimated mandatory start: 6 April ${startYear}. Keep digital records and send each update using compatible software.`;
  setText('mtd-status', status);
  quarters.replaceChildren(...quarterlyDates.map((isoDate, index) => {
    const item = document.createElement('li');
    item.append(`Update ${index + 1} due `, dateElement(isoDate));
    return item;
  }));

  const annualReturn = document.getElementById('final-return');
  annualReturn.replaceChildren();
  if (finalReturnDate) {
    annualReturn.append('Annual tax return (final declaration) due ', dateElement(finalReturnDate), '.');
  }
  return status;
}

function render() {
  const invalid = inputs.filter(input => !input.validity.valid);
  for (const input of inputs) {
    if (input.validity.valid) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
  }
  if (invalid.length) {
    error.textContent = `Check ${invalid[0].labels[0].textContent}. ${invalid[0].validationMessage}`;
    results.hidden = true;
    announcement.textContent = '';
    return;
  }

  const values = Object.fromEntries(inputs.map(input => [input.id, input.valueAsNumber]));
  values.voluntaryClass2 = document.getElementById('voluntaryClass2').checked;
  let estimate;
  try {
    estimate = calculate(values);
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    results.hidden = true;
    announcement.textContent = '';
    return;
  }

  error.textContent = '';
  for (const id of amountIds) setText(id, money.format(estimate[id]));
  setText('firstInstalment', money.format(estimate.july));
  setText('secondInstalment', money.format(estimate.july));
  for (const id of ['credit-label', 'accountCredit']) {
    document.getElementById(id).hidden = estimate.accountCredit === 0;
  }
  setText('class2-note', estimate.class2Eligible
    ? 'Trading profit is below £7,105. Eligible sole traders can choose voluntary Class 2 to protect their National Insurance record.'
    : '');
  const mtdStatus = renderCalendar(estimate.mtd);
  results.hidden = false;
  announcement.textContent = `Save ${money.format(estimate.monthlySaving)} per month. January: ${money.format(estimate.january)}. July: ${money.format(estimate.july)}. ${mtdStatus}`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
