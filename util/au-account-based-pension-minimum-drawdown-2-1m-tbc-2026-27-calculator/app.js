import { personalCap, projectPension } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const error = byId('input-error');
const rows = byId('schedule-rows');
const results = byId('results');
const projection = byId('projection');
const warning = byId('scenario-warning');
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol'
});
const amount = value => currency.format(value);
const milestone = value => value === null ? 'Outside projection' : amount(value);

function showField(container, visible) {
  container.hidden = !visible;
  container.querySelector('input').disabled = !visible;
}

function makeRow(row) {
  const tr = document.createElement('tr');
  tr.classList.toggle('step-up', row.stepUp);
  const year = document.createElement('th');
  year.scope = 'row';
  year.textContent = `${row.year}–${String(row.year + 1).slice(-2)}`;
  tr.append(year);
  const cells = [
    row.age, row.stepUp ? `${row.rate}% ↑` : `${row.rate}%`, amount(row.opening), amount(row.minimum),
    amount(row.withdrawal), amount(row.closing), amount(row.realClosing)
  ];
  for (const value of cells) {
    const cell = document.createElement('td');
    cell.textContent = value;
    tr.append(cell);
  }
  return tr;
}

function render() {
  const isNew = byId('timing').value === 'new';
  const isCustom = byId('drawdown-mode').value === 'custom';
  const hasHistory = byId('cap-mode').value === 'existing';
  showField(byId('date-field'), isNew);
  showField(byId('start-age-field'), isNew);
  showField(byId('target-field'), isCustom);
  document.querySelectorAll('[data-historic]').forEach(field => showField(field, hasHistory));
  byId('balance-label').textContent = isNew ? 'Pension balance at commencement (A$)' : 'Pension balance on 1 July 2026 (A$)';

  const number = id => byId(id).valueAsNumber;
  const type = byId('pension-type').value;
  try {
    const invalid = [...form.elements].find(field => field.willValidate && !field.validity.valid);
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);

    const forecast = projectPension({
      age: number('age'), balance: number('balance'), type,
      startDate: isNew ? byId('start-date').value : '',
      startAge: isNew ? number('start-age') : undefined,
      target: isCustom ? number('target') : null,
      netReturn: number('return'), inflation: number('inflation')
    });
    const cap = personalCap({
      priorCap: hasHistory ? number('prior-cap') : null,
      highestTba: number('highest-tba'), peakCap: number('peak-cap'),
      currentTba: number('current-tba'), previouslyReachedCap: byId('reached-cap').checked
    });

    const first = forecast.rows[0];
    byId('annual-output').textContent = amount(first.minimum);
    byId('monthly-output').textContent = amount(first.monthly);
    byId('cap-output').textContent = amount(cap.cap);
    byId('space-output').textContent = amount(cap.space);
    byId('age-85-output').textContent = milestone(forecast.age85);
    byId('age-95-output').textContent = milestone(forecast.age95);

    const paymentDetails = [`The age-${first.age} rate is ${first.rate}%. Monthly equivalent is the annual minimum divided by 12.`];
    if (first.fraction < 1) {
      paymentDetails.push(byId('start-date').value >= '2027-06-01'
        ? 'The 1 June exception waives the first-year minimum.'
        : `The first-year minimum uses ${Math.round(first.fraction * 365)} of 365 days.`);
    }
    if (first.maximum !== null) paymentDetails.push(`2026–27 TTR maximum is ${amount(first.maximum)} while TTR restrictions apply.`);
    byId('payment-note').textContent = paymentDetails.join(' ');
    byId('cap-note').textContent = hasHistory
      ? `${cap.unusedPercent}% unused for indexation gives a ${amount(cap.increase)} increase. Space is measured against your entered current or planned TBA balance.`
      : 'The full indexed cap applies when your first retirement-phase income stream starts in 2026–27.';

    const scenarioNotes = [];
    if (cap.excess > 0) scenarioNotes.push(`Your entered transfer balance exceeds the estimated cap by ${amount(cap.excess)}. Verify the account with the ATO before transferring more.`);
    if (first.target !== null && first.target < first.minimum) scenarioNotes.push('The first-year spending target is below the required minimum. The projection uses at least the minimum where funds allow.');
    const shortfall = forecast.rows.find(row => row.target !== null && row.withdrawal < row.target);
    if (shortfall) scenarioNotes.push(`The drawdown falls below your target in the financial year starting July ${shortfall.year} because of the available balance or the TTR limit.`);
    const depletion = forecast.rows.find(row => row.closing === 0);
    if (depletion) scenarioNotes.push(`The projected pension balance reaches zero in the financial year starting July ${depletion.year}.`);

    rows.replaceChildren(...forecast.rows.map(makeRow));
    warning.textContent = scenarioNotes.join(' ');
    warning.hidden = scenarioNotes.length === 0;
    error.hidden = true;
    results.hidden = false;
    projection.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    projection.hidden = true;
    warning.hidden = true;
  }
}

function update(event) {
  if (event.target === byId('age') || event.target === byId('timing')) {
    byId('start-age').value = byId('age').value;
  }
  render();
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
render();
