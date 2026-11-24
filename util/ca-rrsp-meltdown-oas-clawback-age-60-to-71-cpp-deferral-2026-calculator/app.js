import { compare, DEFAULTS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('scenario-inputs');
const inputs = Object.keys(DEFAULTS).map(byId);
const target = byId('target');
const targetPreset = byId('target-preset');
const results = byId('results');
const annualPanel = byId('annual-panel');
const chart = byId('timeline');
const metric = byId('chart-metric');
const ageControl = byId('chart-age');
const drawing = byId('chart-drawing');
const chartFrame = { left: 78, right: 535, top: 18, bottom: 210, width: 560 };
const dollars = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0
});
const compact = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 1
});
const metricValue = (year, key) => key === 'combined' ? year.incomeTax + year.recovery : year[key];
let projection;

function amount(value) {
  return dollars.format(Math.round(value) || 0);
}

function renderRows(body, rows) {
  body.replaceChildren(...rows.map(([label, a, b]) => {
    const tr = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    tr.append(heading);
    for (const value of [a, b]) {
      const cell = document.createElement('td');
      cell.textContent = amount(value);
      tr.append(cell);
    }
    return tr;
  }));
}

function renderTotals() {
  const { meltdown: a, defer: b, lifetimeTaxSaved, terminalTaxSaved, wealthAdvantage } = projection;
  const lastAge = a.rows.at(-1).age;
  byId('terminal-label').textContent = `Terminal tax saved at age ${lastAge}`;
  for (const [id, value] of [
    ['lifetime-saved', lifetimeTaxSaved], ['terminal-saved', terminalTaxSaved], ['wealth-advantage', wealthAdvantage]
  ]) {
    const output = byId(id);
    output.textContent = amount(value);
    output.classList.toggle('bad', Math.round(value) < 0);
  }

  const delta = Math.round(wealthAdvantage);
  const summary = byId('comparison-summary');
  const winner = delta > 0 ? 'The meltdown strategy' : 'The deferred RRIF strategy';
  const advantage = delta === 0 ? 'Both strategies produce the same projected net wealth to the nearest dollar.'
    : `${winner} leaves ${amount(Math.abs(delta))} more in projected net wealth at age ${lastAge}.`;
  const gap = Math.round(a.unfundedSpending + b.unfundedSpending) > 0;
  summary.textContent = gap ? `${advantage} Review the unfunded spending below before comparing the plans.` : advantage;
  summary.classList.toggle('bad', gap);

  const labels = [
    ['Lifetime regular income tax', 'regularIncomeTax'],
    ['Lifetime OAS recovery before terminal inclusion', 'regularRecovery'],
    ['Cumulative OAS clawback including final return', 'totalRecovery'],
    ['Extra income tax on the final return', 'terminalIncomeTax'],
    ['Extra OAS recovery on the final return', 'terminalRecovery'],
    ['Total incremental terminal tax', 'terminalTax'],
    ['After-tax estate', 'estate'],
    ['Cumulative unfunded spending', 'unfundedSpending'],
    ['Net wealth after funding adjustment', 'netWealth']
  ];
  renderRows(byId('totals-body'), labels.map(([label, key]) => [label, a[key], b[key]]));
}

function svg(name, attrs, label) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (label !== undefined) node.textContent = label;
  return node;
}

function renderChart(updateTable = false) {
  const a = projection.meltdown.rows;
  const b = projection.defer.rows;
  const key = metric.value;
  const label = metric.selectedOptions[0].textContent;
  const start = a[0].age;
  const end = a.at(-1).age;
  ageControl.min = start;
  ageControl.max = end;
  ageControl.disabled = start === end;
  const selected = Number(ageControl.value);
  byId('selected-age').value = selected;
  byId('year-heading').textContent = `Age ${selected}`;
  byId('chart-desc').textContent = `${label} from age ${start} to ${end}. Use the age slider or select an age on the chart. Exact values appear in the tables below.`;

  const { left, right, top, bottom } = chartFrame;
  const maximum = Math.max(1, ...[...a, ...b].map(year => metricValue(year, key)));
  const unit = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = Math.ceil(maximum / 4 / unit) * unit;
  const x = age => start === end ? (left + right) / 2 : left + (age - start) / (end - start) * (right - left);
  const y = value => bottom - value / (step * 4) * (bottom - top);
  const elements = [];

  for (let i = 0; i <= 4; i++) {
    const height = y(i * step);
    elements.push(svg('line', { x1: left, x2: right, y1: height, y2: height, stroke: '#d9e0ea' }));
    elements.push(svg('text', { x: left - 8, y: height + 5, 'text-anchor': 'end', fill: 'currentColor', 'font-size': 14 }, compact.format(i * step)));
  }
  const ageStep = Math.max(1, Math.ceil((end - start) / 6));
  const ages = a.map(year => year.age).filter(age => (age - start) % ageStep === 0 && age < end);
  ages.push(end);
  for (const age of ages) {
    if (age !== end && end - age < ageStep / 2) continue;
    elements.push(svg('text', { x: x(age), y: bottom + 23, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': 15 }, age));
  }
  elements.push(svg('line', { x1: x(selected), x2: x(selected), y1: top, y2: bottom, stroke: '#64748b', 'stroke-dasharray': '3 4' }));
  for (const [series, color, dash, radius] of [[a, '#1762b0', 'none', 6], [b, '#9a4111', '7 5', 3]]) {
    const points = series.map(year => `${x(year.age)},${y(metricValue(year, key))}`).join(' ');
    elements.push(svg('polyline', { points, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-dasharray': dash }));
    elements.push(svg('circle', { cx: x(selected), cy: y(metricValue(series[selected - start], key)), r: radius, fill: color }));
  }
  drawing.replaceChildren(...elements);

  const yearA = a[selected - start];
  const yearB = b[selected - start];
  const details = [
    ['Registered withdrawal', 'withdrawal'], ['Mandatory RRIF minimum', 'minimum'],
    ['CPP or QPP', 'cpp'], ['Gross OAS', 'oas'], ['Income tax', 'incomeTax'], ['OAS clawback', 'recovery'],
    ['Year-end RRSP/RRIF', 'registered'], ['Year-end TFSA', 'tfsa'], ['Year-end other savings', 'cash'],
    ['Unfunded spending', 'shortfall']
  ];
  renderRows(byId('selected-body'), details.map(([name, field]) => [name, yearA[field], yearB[field]]));
  if (updateTable) {
    byId('yearly-caption').textContent = label;
    renderRows(byId('yearly-body'), a.map((year, index) => [year.age, metricValue(year, key), metricValue(b[index], key)]));
  }
}

function update() {
  const error = byId('form-error');
  const invalid = inputs.find(input => !input.validity.valid);
  const wrongOrder = byId('deathAge').valueAsNumber < byId('startAge').valueAsNumber;
  if (invalid || wrongOrder) {
    const label = invalid?.labels[0].textContent;
    error.textContent = invalid ? `${label} — ${invalid.validationMessage}` : 'Age at death must be at or above retirement age.';
    error.hidden = false;
    results.hidden = true;
    annualPanel.hidden = true;
    return;
  }

  const settings = Object.fromEntries(inputs.map(input => [
    input.id, input.type === 'number' ? input.valueAsNumber : input.value
  ]));
  projection = compare(settings);
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  annualPanel.hidden = false;
  renderTotals();
  renderChart(true);
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === targetPreset) {
    if (targetPreset.value) target.value = targetPreset.value;
    else target.focus();
  }
  if (event.target === target) {
    targetPreset.value = ['58523', '95323'].includes(target.value) ? target.value : '';
  }
  update();
});
metric.addEventListener('change', () => renderChart(true));
ageControl.addEventListener('input', () => renderChart());
chart.addEventListener('click', event => {
  if (!projection) return;
  const rect = chart.getBoundingClientRect();
  const { left, right, width } = chartFrame;
  const chartX = (event.clientX - rect.left) * width / rect.width;
  const position = Math.max(0, Math.min(1, (chartX - left) / (right - left)));
  const start = Number(ageControl.min);
  const end = Number(ageControl.max);
  ageControl.value = Math.round(start + position * (end - start));
  renderChart();
});
update();
