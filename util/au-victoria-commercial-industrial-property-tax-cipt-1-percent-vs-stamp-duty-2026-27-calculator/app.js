import { HORIZON, project } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('calculator');
const chartMode = get('chart-mode');
const error = get('input-error');
const results = get('results');
const set = (id, value) => { get(id).textContent = value; };
const format = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code', maximumFractionDigits: 0
});
const centsFormat = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code'
});
const compact = new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 });
const aud = amount => format.format(amount);
const fields = [...form.querySelectorAll('input[type="number"]')];
let latest;

function svg(tag, attrs, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTrajectory({ rows, dutySaved }) {
  const present = chartMode.value === 'pv';
  const entry = present ? 'entryPV' : 'entryTotal';
  const resale = present ? 'resalePV' : 'resaleTotal';
  const last = rows[HORIZON];
  const peak = Math.max(dutySaved, last[entry], last[resale]);
  const roughStep = Math.max(1, peak / 4);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].find(size => size * magnitude >= roughStep) * magnitude;
  const x = year => 78 + year / HORIZON * 400;
  const y = amount => 200 - amount / (4 * step) * 168;
  const plot = document.createDocumentFragment();

  for (let tick = 0; tick <= 4; tick++) {
    const value = tick * step;
    plot.append(
      svg('line', { x1: x(0), x2: x(HORIZON), y1: y(value), y2: y(value), stroke: '#cfdbeb' }),
      svg('text', { x: x(0) - 9, y: y(value) + 5, 'text-anchor': 'end' }, compact.format(value))
    );
  }
  for (let year = 0; year <= HORIZON; year += 5) {
    plot.append(svg('text', { x: x(year), y: 222, 'text-anchor': 'middle' }, year));
  }
  plot.append(
    svg('text', { x: x(0), y: 19, 'text-anchor': 'end' }, 'AUD'),
    svg('text', { x: x(12.5), y: 243, 'text-anchor': 'middle' }, 'Hold year'),
    svg('line', { x1: x(0), x2: x(HORIZON), y1: y(dutySaved), y2: y(dutySaved),
      stroke: '#6b467c', 'stroke-width': 3, 'stroke-dasharray': '2 5' })
  );

  for (const [key, colour, dash] of [[entry, '#2259bb', 'none'], [resale, '#007668', '7 4']]) {
    const changes = rows.slice(1).map(row => `H ${x(row.year)} V ${y(row[key])}`).join(' ');
    plot.append(svg('path', { d: `M ${x(0)} ${y(rows[0][key])} ${changes}`, fill: 'none',
      stroke: colour, 'stroke-width': 3, 'stroke-dasharray': dash }));
  }
  get('chart-content').replaceChildren(plot);
  set('chart-description', `Year 25 ${present ? 'present-value' : 'nominal'} costs in AUD. Entry purchase ${aud(last[entry])}, exempt resale ${aud(last[resale])}, traditional cash duty ${aud(dutySaved)}.`);

  set('schedule-caption', present
    ? 'Annual outflows and cumulative costs in settlement-year AUD'
    : 'Annual outflows and cumulative costs in nominal AUD');
  const schedule = document.createDocumentFragment();
  const annualValue = (row, key) => present ? row[key] - (rows[row.year - 1]?.[key] ?? 0) : row[key];
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const value of [
      row.year, row.calendarYear, aud(annualValue(row, present ? 'entryPV' : 'entryAnnual')),
      aud(annualValue(row, present ? 'resalePV' : 'resaleAnnual')), aud(row[entry]), aud(row[resale])
    ]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    schedule.append(tr);
  }
  get('schedule-body').replaceChildren(schedule);
}

function render(result, useLoan) {
  const resaleHoldYear = result.firstResaleYear - result.rows[0].calendarYear;
  const yearLabel = year => year === null ? 'Beyond 25 years' : `Year ${year} (${result.rows[year].calendarYear})`;
  set('duty-saved', aud(result.dutySaved));
  set('entry-bill', `${aud(result.rows[11].entryGross)}/yr`);
  set('entry-year', `${result.firstEntryYear} assessment · before deductions`);
  set('resale-bill', `${aud(result.rows[resaleHoldYear].resaleGross)}/yr`);
  set('resale-year', `Hold year ${resaleHoldYear} · ${result.firstResaleYear} assessment · before deductions`);
  set('loan-payment', result.loanPayment === null ? 'Unavailable' : `${centsFormat.format(result.loanPayment)}/yr`);
  set('loan-status', result.loanPayment === null
    ? 'Calculated duty is outside the loan range'
    : useLoan ? 'Included in years 1–10' : 'Illustrative payment if financed');
  set('nominal-breakeven', yearLabel(result.nominalBreakeven));
  set('npv-breakeven', yearLabel(result.npvBreakeven));
  const cost = aud(result.rows[HORIZON].resaleTotal);
  set('holding-warning', `Buyer B saves ${aud(result.dutySaved)} at settlement and incurs ${cost} in projected after-tax CIPT over ${HORIZON} years. Check how higher site-value growth changes the annual bill before relying on the upfront saving.`);
  renderTrajectory(result);
}

function update() {
  get('priorEntryYear').max = Number.isInteger(get('purchaseYear').valueAsNumber)
    ? get('purchaseYear').value : '9974';
  const invalid = fields.find(field => !field.validity.valid);
  for (const field of fields) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }
  const useLoan = get('financing').value === 'loan';
  try {
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    const values = Object.fromEntries(fields.map(field => [field.id, field.valueAsNumber]));
    latest = project({ ...values, useLoan, buildToRent: get('cipt-rate').value === 'btr' });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    latest = undefined;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  render(latest, useLoan);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
chartMode.addEventListener('change', () => {
  if (latest) renderTrajectory(latest);
});
update();
