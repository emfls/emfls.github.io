import { defaults, simulate } from './model.mjs';

const form = document.getElementById('calculator');
const error = document.getElementById('error');
const results = document.getElementById('results');
const element = id => document.getElementById(id);
const field = name => form.elements.namedItem(name);
const dollars = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'code' });
const tableDollars = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cents = value => Math.round(Math.abs(value) * 100) / 100 * Math.sign(value);
const money = value => dollars.format(cents(value) || 0);

function readInputs() {
  return Object.fromEntries(Object.keys(defaults).map(name => {
    const input = field(name);
    if (input.type === 'checkbox') return [name, input.checked];
    if (input.disabled) return [name, defaults[name]];
    if (input.type === 'select-one') return [name, Number(input.value)];
    return [name, input.valueAsNumber];
  }));
}

function drawChart(rows) {
  const values = rows.flatMap(row => [row.homeWealth, row.rentvestWealth]);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const range = high - low || 1;
  const y = value => 204 - (value - low) / range * 188;
  const points = key => rows.length === 1
    ? `294,${y(rows[0][key])} 306,${y(rows[0][key])}`
    : rows.map((row, i) => `${12 + i / (rows.length - 1) * 576},${y(row[key])}`).join(' ');
  element('zero-line').setAttribute('d', `M12 ${y(0)} H588`);
  element('home-line').setAttribute('points', points('homeWealth'));
  element('rentvest-line').setAttribute('points', points('rentvestWealth'));
  element('last-year').textContent = rows.length > 1 ? `Year ${rows.length}` : '';
}

function crossoverText(rows) {
  const changes = [];
  let previousLeader = 0;
  for (const row of rows) {
    const leader = Math.sign(cents(row.gap));
    if (!leader) continue;
    if (previousLeader && leader !== previousLeader) changes.push(row.year);
    previousLeader = leader;
  }
  if (!previousLeader) return 'The strategies tie at every annual snapshot.';
  if (!changes.length) return 'The lead does not change across the annual snapshots.';
  return `Lead changes at ${changes.length === 1 ? 'year' : 'years'} ${changes.join(', ')}.`;
}

function renderRows(rows) {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = row.year;
    tr.append(heading);
    for (const value of [row.homeWealth, row.rentvestWealth, row.gap, row.matchedCash, row.homeLoan,
      row.homeEquity, row.ipLoan, row.ipEquity, -row.rentalTax, row.ipCgt]) {
      const cell = document.createElement('td');
      cell.textContent = tableDollars.format(cents(value) || 0);
      tr.append(cell);
    }
    fragment.append(tr);
  }
  element('year-rows').replaceChildren(fragment);
}

function update() {
  const applies = field('fhb').checked;
  element('fhb-relief').hidden = !applies;
  field('fhbRelief').disabled = !applies;
  let projection;
  try {
    projection = simulate(readInputs());
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }
  error.hidden = true;
  error.textContent = '';

  const { initial, rows, final } = projection;
  const gap = cents(final.gap);
  const winner = gap > 0 ? 'Rentvesting' : 'Buying a home';
  element('winner').textContent = gap === 0
    ? `The strategies tie at Year ${final.year}.`
    : `${winner} leads by ${money(Math.abs(gap))} at Year ${final.year}.`;
  element('home-wealth').textContent = money(final.homeWealth);
  element('rentvest-wealth').textContent = money(final.rentvestWealth);
  element('refunds').textContent = money(final.cumulativeRefunds);
  element('sale-tax').textContent = money(final.ipCgt);
  element('cash-summary').textContent = `Both strategies start with ${money(initial.matchedCash)} and use ${money(final.matchedCash)} each in Year ${final.year}. CGT on the fully exempt home is ${money(final.homeCgt)}.`;
  element('crossover').textContent = crossoverText(rows);
  drawChart(rows);
  renderRows(rows);
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
