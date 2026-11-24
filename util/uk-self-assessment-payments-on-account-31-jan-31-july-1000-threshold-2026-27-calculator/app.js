import { calculatePayments, parsePounds } from './model.mjs';

const form = document.getElementById('tax-inputs');
const results = document.getElementById('results');
const error = document.getElementById('input-error');
const forecast = document.getElementById('forecast-result');
const scheduleBody = document.getElementById('schedule-body');
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = pence => currency.format(pence / 100);
const amountFields = [
  'assessedTax', 'atSource', 'capitalGains', 'studentLoans',
  'priorJanuary', 'priorJuly', 'reserve', 'forecastTax',
];

function display(id, value) {
  document.getElementById(id).textContent = value;
}

function update() {
  const inputs = { monthsToJanuary: Number(form.elements.namedItem('monthsToJanuary').value) };
  const invalid = [];
  for (const name of amountFields) {
    const input = form.elements.namedItem(name);
    const optionalBlank = name === 'forecastTax' && input.value.trim() === '';
    inputs[name] = parsePounds(input.value.trim());
    const failed = inputs[name] === null && !optionalBlank;
    input.setAttribute('aria-invalid', String(failed));
    if (failed) invalid.push(input.labels[0].textContent);
  }

  results.hidden = invalid.length > 0;
  error.textContent = invalid.length
    ? `Enter amounts from £0 to £1 billion with up to two decimal places for ${invalid.join(', ')}.`
    : '';
  if (invalid.length) return;

  const result = calculatePayments(inputs);
  const reasons = [];
  if (result.belowThreshold) reasons.push('the net eligible bill is below £1,000');
  if (result.overEightyPercent) reasons.push('more than 80% was covered at source');
  display('eligibility', result.triggered
    ? 'YES. The net eligible bill is at least £1,000 and 80% or less was covered at source.'
    : `NO because ${reasons.join(' and ')}.`);
  display('january-due', money(result.januaryDue));
  display('january-credit', result.januaryCredit ? `Estimated credit after January’s instalment: ${money(result.januaryCredit)}.` : '');
  display('july-due', money(result.secondPayment));
  display('monthly-transfer', money(result.monthlyTransfer));
  display('net-tax', money(result.netTax));
  display('capital-gains', money(inputs.capitalGains));
  display('student-loans', money(inputs.studentLoans));
  display('prior-payments', money(result.priorPayments));
  display('balancing', result.balancingPayment < 0
    ? `${money(-result.balancingPayment)} credit before the first advance`
    : money(result.balancingPayment));
  display('first-payment', money(result.firstPayment));

  const rows = result.schedule.map(({ month: offset, transfer, due, pot }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = month.format(Date.UTC(2027, offset, 1));
    row.append(heading);
    for (const value of [transfer, due, pot]) {
      const cell = row.insertCell();
      cell.textContent = money(value);
    }
    return row;
  });
  scheduleBody.replaceChildren(...rows);

  const reduction = result.reduction;
  if (!result.triggered) forecast.textContent = 'No payments on account to reduce.';
  else if (inputs.forecastTax === null) forecast.textContent = 'Enter your forecast net 2026/27 tax to compare a possible claim.';
  else if (!reduction) forecast.textContent = 'This forecast does not support a reduction.';
  else {
    const januaryCredit = reduction.januaryCredit ? ` with an estimated ${money(reduction.januaryCredit)} credit` : '';
    forecast.textContent = `Estimated reduced advances: ${money(reduction.first)} in January and ${money(reduction.second)} in July. This reduces the total advances by ${money(reduction.totalSavings)}. January cash due would be ${money(reduction.januaryDue)}${januaryCredit}. The savings schedule above uses the original instalments.`;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
