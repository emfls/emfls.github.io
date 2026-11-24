import { compareStates, states } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('payroll-form');
const mode = byId('mode');
const allocationFields = byId('allocations');
const results = byId('results');
const error = byId('error');
const losses = byId('losses');
const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 4 });

function tableRow(label, values) {
  const row = document.createElement('tr');
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);
  for (const value of values) {
    const cell = row.insertCell();
    cell.className = 'number';
    cell.textContent = value;
  }
  return row;
}

function render() {
  const split = mode.value === 'split';
  allocationFields.hidden = !split;
  allocationFields.disabled = !split;

  try {
    if (!form.checkValidity()) {
      throw new RangeError('Enter a non-negative wage amount with up to two decimal places in each visible wage field.');
    }

    const australianWages = byId('wages').valueAsNumber;
    const allocations = split ? Object.fromEntries(states.map(state => [
      state, byId('wages-' + state.toLowerCase()).valueAsNumber,
    ])) : undefined;
    const { rows, relocationDelta, combinedAnnualTax } = compareStates(australianWages, {
      allocations,
      regionalVic: byId('regional-vic').checked,
      regionalQld: byId('regional-qld').checked,
    });

    const totals = byId('totals');
    if (split) {
      totals.textContent = 'Combined tax for the five states: ' + aud.format(combinedAnnualTax)
        + ' per year · ' + aud.format(combinedAnnualTax / 12) + ' per month';
    } else {
      const lowest = rows[0].annualTax;
      const highest = rows.at(-1).annualTax;
      const stateNamesAt = tax => rows.filter(row => aud.format(row.annualTax) === aud.format(tax))
        .map(row => row.state).join(', ');
      totals.textContent = aud.format(highest) === aud.format(lowest)
        ? 'All five estimates are equal to the nearest cent. Relocation gap: ' + aud.format(0) + ' per year.'
        : 'Annual relocation gap: ' + aud.format(relocationDelta)
          + ' (lowest: ' + stateNamesAt(lowest) + ' · highest: ' + stateNamesAt(highest) + ').';
    }

    byId('ranking-caption').textContent = split
      ? 'Actual wage split, sorted by annual tax'
      : 'Same payroll in each state, sorted by annual tax';
    byId('ranking').replaceChildren(...rows.map(row => tableRow(row.state, [
      aud.format(row.annualTax),
      row.stateWages ? percent.format(row.effectiveRate) : '—',
      aud.format(row.monthlyTax),
      aud.format(row.deduction),
    ])));
    byId('levy-rows').replaceChildren(...['VIC', 'QLD'].map(state => {
      const row = rows.find(result => result.state === state);
      return tableRow(state, [
        aud.format(row.baseTax), aud.format(row.mentalHealth),
        state === 'VIC' ? aud.format(row.covidDebt) : '—',
      ]);
    }));

    const reduced = rows.filter(row => row.deductionLost > 0);
    byId('loss-status').textContent = reduced.length
      ? 'Current deduction losses compared with each state’s maximum at the same wage share:'
      : 'None of the entered state wages currently trigger a taper.';
    losses.replaceChildren(...reduced.map(row => {
      const item = document.createElement('li');
      item.textContent = row.state + ' has lost ' + aud.format(row.deductionLost) + ' of its annual deduction.';
      return item;
    }));
    losses.hidden = !reduced.length;
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.hidden = false;
    error.textContent = issue.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
