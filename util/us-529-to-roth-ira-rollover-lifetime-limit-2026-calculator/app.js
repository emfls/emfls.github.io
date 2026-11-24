import { calculateRollover, LAST_PROJECTION_YEAR } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('rollover-form');
const errorOutput = byId('input-error');
const resultSections = ['results', 'schedule', 'comparison'].map(byId);
const scheduleRows = byId('schedule-rows');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const calendar = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const money = value => currency.format(value);
const displayDate = date => calendar.format(new Date(date));

function readInputs() {
  const values = {};
  for (const field of form.elements) {
    if (!field.name) continue;
    if (!field.validity.valid) {
      throw new RangeError(`${field.labels[0].textContent.trim()}. ${field.validationMessage}`);
    }
    if (field.type === 'checkbox') {
      values[field.name] = field.checked;
    } else {
      values[field.name] = field.type === 'number' ? field.valueAsNumber : field.value;
    }
  }
  return values;
}

function renderSchedule(schedule, unscheduledTarget) {
  const rows = document.createDocumentFragment();
  for (const { year, annualRoom, amount, cumulative } of schedule) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year;
    row.append(heading);
    for (const value of [annualRoom, amount, cumulative]) {
      const cell = document.createElement('td');
      cell.textContent = money(value);
      row.append(cell);
    }
    rows.append(row);
  }
  scheduleRows.replaceChildren(rows);

  const unscheduled = byId('unscheduled');
  unscheduled.hidden = unscheduledTarget === 0;
  unscheduled.textContent =
    `${money(unscheduledTarget)} of the potential transfer amount remains unscheduled through ${LAST_PROJECTION_YEAR} under these assumptions.`;
}

function renderComparison(comparison) {
  byId('comparison-empty').hidden = Boolean(comparison);
  byId('comparison-values').hidden = !comparison;
  byId('withdrawal-cost').hidden = !comparison;
  if (!comparison) return;

  const { gross, rothAt65, netCash, federalTax, federalPenalty, taxableEarnings } = comparison;
  byId('comparison-basis').textContent =
    `Both scenarios use ${money(gross)}, the sum of projected transfers through the year the beneficiary turns 65. The cash scenario withdraws that amount now.`;
  byId('roth-value').textContent = money(rothAt65);
  byId('net-cash').textContent = money(netCash);
  byId('withdrawal-cost').textContent =
    `${money(taxableEarnings)} in taxable earnings generates ${money(federalTax)} in estimated federal income tax plus a ${money(federalPenalty)} federal penalty.`;
}

function update() {
  let input;
  let result;
  try {
    input = readInputs();
    result = calculateRollover(input);
  } catch (error) {
    errorOutput.textContent = error.message;
    errorOutput.hidden = false;
    for (const section of resultSections) section.hidden = true;
    return;
  }

  errorOutput.hidden = true;
  byId('allowed').textContent = money(result.allowed2026);
  byId('lifetime').textContent = money(result.remainingLifetimeCap);
  byId('pool').textContent = money(result.eligiblePool);
  const eligibleDate = displayDate(result.eligibleOn);
  byId('age-clock').textContent = result.accountEligible
    ? `15-year rule met. The account reached its 15-year anniversary on ${eligibleDate}.`
    : `15-year rule pending. Earliest modeled transfer date under this rule is ${eligibleDate}.`;
  byId('funds-clock').textContent =
    `Five-year lookback. Only contributions made before ${displayDate(result.lookbackBefore)} and their attributable earnings count.`;
  byId('annual-room').textContent = `2026 IRA room after existing contributions and transfers is ${money(result.room2026)}.`;
  byId('transfer-gate').hidden = input.directTransfer;

  renderSchedule(result.schedule, result.unscheduledTarget);
  renderComparison(result.comparison);
  for (const section of resultSections) section.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
window.addEventListener('pageshow', update);
update();

for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (slot.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
