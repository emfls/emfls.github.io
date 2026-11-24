import { annualFees, compare, PRESETS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('fee-form');
const slider = byId('chart-balance');
const chart = byId('fee-chart');
const panels = ['results', 'chart-panel', 'pooling-panel'].map(byId);
const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code',
});
const signedAud = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code', signDisplay: 'exceptZero',
});
const signedPercent = new Intl.NumberFormat('en-AU', {
  style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 });
const cleanZero = value => Math.abs(value) < 0.005 ? 0 : value;
const formatMoney = value => aud.format(cleanZero(value)).replace(/AUD\s+/, 'A$');
const formatSavings = value => signedAud.format(cleanZero(value)).replace(/AUD\s+/, 'A$');
const setText = (id, value) => { byId(id).textContent = value; };
const numericFields = ['balance', 'gross', 'accounting', 'actuarial', 'setup', 'mer', 'fixedWeekly', 'admin', 'investment'];
const box = { left: 92, right: 493, top: 24, bottom: 244 };
let chartState;

function getOptions() {
  return {
    ...Object.fromEntries(numericFields.map(key => [key, byId(key).valueAsNumber])),
    members: Number(byId('members').value),
    trustee: byId('trustee').value,
    adminCap: byId('adminCap').value === '' ? null : byId('adminCap').valueAsNumber,
  };
}

function cheaperRanges(breakeven) {
  const cheaper = breakeven.ranges.filter(range => range.relation === 'smsf');
  if (cheaper.length === 0) return 'None';
  return cheaper.map(({ from, to }) => {
    if (from === 0 && to === Infinity) {
      return breakeven.points.includes(0) ? 'Above A$0' : 'All balances';
    }
    if (from === 0 && !breakeven.points.includes(0)) return `Below ${formatMoney(to)}`;
    if (to === Infinity) return `Above ${formatMoney(from)}`;
    return `Between ${formatMoney(from)} and ${formatMoney(to)}`;
  }).join(' or ');
}

function matchingFees(breakeven) {
  const ties = breakeven.ranges.filter(range => range.relation === 'tie');
  if (ties.length) {
    return ties.map(({ from, to }) => {
      if (from === 0) return to === Infinity ? 'All balances' : `Up to ${formatMoney(to)}`;
      if (to === Infinity) return `From ${formatMoney(from)}`;
      return `${formatMoney(from)} to ${formatMoney(to)}`;
    }).join(' or ');
  }
  return breakeven.points.length ? breakeven.points.map(formatMoney).join(' and ') : 'No fee match';
}

function makeRow(heading, values) {
  const row = document.createElement('tr');
  const label = document.createElement('th');
  label.scope = 'row';
  label.textContent = heading;
  row.append(label);
  for (const value of values) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  }
  return row;
}

function drawTable(result, members) {
  const feeRows = [
    ['Year 1 cash cost', result.first],
    ['Ongoing annual', result.ongoing],
    ['Annualised setup comparison', result.annualised],
  ].map(([label, values]) => {
    const rate = values.savingsRate === null ? 'N/A' : signedPercent.format(cleanZero(values.savingsRate) / 100);
    return makeRow(label, [formatMoney(values.smsf), formatMoney(values.apra), `${formatSavings(values.savings)} (${rate})`]);
  });
  byId('fees-body').replaceChildren(...feeRows);

  const poolingRows = result.pooling.map(row => {
    const selected = row.members === members;
    const element = makeRow(selected ? `${row.members} (selected)` : row.members, [
      formatMoney(row.perMemberBalance), cheaperRanges(row.breakeven), formatSavings(row.savings),
    ]);
    element.dataset.selected = String(selected);
    return element;
  });
  byId('pooling-body').replaceChildren(...poolingRows);
}

function svgNode(tag, attributes, content = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.textContent = content;
  return node;
}

function updateChartCursor() {
  if (!chartState) return;
  const { options, domain, x, y } = chartState;
  const balance = slider.valueAsNumber / Number(slider.max) * domain;
  const fees = annualFees(options, balance);
  for (const [id, fee] of [['point-smsf', fees.smsf], ['point-apra', fees.apra]]) {
    byId(id).setAttribute('cx', x(balance));
    byId(id).setAttribute('cy', y(fee));
  }
  byId('chart-cursor').setAttribute('x1', x(balance));
  byId('chart-cursor').setAttribute('x2', x(balance));
  slider.setAttribute('aria-valuetext', formatMoney(balance));
  setText('chart-readout', `${formatMoney(balance)} combined · SMSF ${formatMoney(fees.smsf)}/yr · Benchmark ${formatMoney(fees.apra)}/yr`);
}

function drawChart(options, breakeven) {
  const { points, capBalance } = breakeven;
  const domain = Math.max(10000, options.balance, ...points) * 1.25;
  const samples = capBalance > 0 && capBalance < domain ? [0, capBalance, domain] : [0, domain];
  const sampledFees = samples.map(balance => annualFees(options, balance));
  const maxFee = Math.max(1, sampledFees.at(-1).smsf, sampledFees.at(-1).apra) * 1.08;
  const x = balance => box.left + balance / domain * (box.right - box.left);
  const y = fee => box.bottom - fee / maxFee * (box.bottom - box.top);
  const grid = [];
  for (let i = 0; i <= 4; i++) {
    const fee = maxFee * i / 4;
    grid.push(svgNode('line', { class: 'guide', x1: box.left, x2: box.right, y1: y(fee), y2: y(fee) }));
    grid.push(svgNode('text', { x: box.left - 8, y: y(fee) + 4, 'text-anchor': 'end' }, `A$${compact.format(fee)}`));
    const balance = domain * i / 4;
    grid.push(svgNode('text', { x: x(balance), y: box.bottom + 20, 'text-anchor': 'middle' }, `A$${compact.format(balance)}`));
  }
  grid.push(svgNode('text', { x: box.left, y: 15 }, 'Fees per year'));
  grid.push(svgNode('text', { x: (box.left + box.right) / 2, y: 286, 'text-anchor': 'middle' }, 'Combined balance'));
  byId('chart-grid').replaceChildren(...grid);
  for (const type of ['smsf', 'apra']) {
    byId(`curve-${type}`).setAttribute('points', samples
      .map((balance, index) => `${x(balance)},${y(sampledFees[index][type])}`).join(' '));
  }
  byId('chart-crossings').replaceChildren(...points.map(balance => {
    const marker = svgNode('circle', {
      cx: x(balance), cy: y(annualFees(options, balance).smsf), r: 4, fill: '#172033', stroke: '#fff',
    });
    marker.append(svgNode('title', {}, `Equal annual fees at ${formatMoney(balance)}`));
    return marker;
  }));

  chartState = { options, domain, x, y };
  slider.value = String(Math.round(options.balance / domain * Number(slider.max)));
  updateChartCursor();
}

function render() {
  if (!form.checkValidity()) {
    const invalid = form.querySelector('input:invalid, select:invalid');
    const name = invalid.labels[0].textContent;
    setText('input-error', `${name} · ${invalid.validationMessage}`);
    panels.forEach(panel => { panel.hidden = true; });
    chartState = undefined;
    return;
  }

  setText('input-error', '');
  const options = getOptions();
  const result = compare(options);
  setText('ongoing-threshold', matchingFees(result.breakeven));
  setText('ongoing-ranges', `Combined balances where ongoing SMSF fees are lower · ${cheaperRanges(result.breakeven)}.`);
  setText('wealth-gap', formatSavings(result.wealth.gap));
  setText('setup-thresholds', `Fee matches with setup · Year 1 cash cost ${matchingFees(result.firstBreakeven)}. Annualised setup ${matchingFees(result.annualisedBreakeven)}.`);
  setText('wealth-balances', `Projected year-20 balances · SMSF ${formatMoney(result.wealth.smsf)}. Benchmark ${formatMoney(result.wealth.apra)}.`);
  drawTable(result, options.members);
  drawChart(options, result.breakeven);
  panels.forEach(panel => { panel.hidden = false; });
}

byId('benchmark').addEventListener('input', event => {
  const preset = PRESETS[event.target.value];
  if (preset) {
    byId('admin').value = preset.admin;
    byId('investment').value = preset.investment;
  }
});
for (const key of ['admin', 'investment']) {
  byId(key).addEventListener('input', () => { byId('benchmark').value = 'custom'; });
}
byId('accounting-preset').addEventListener('input', event => {
  if (event.target.value !== 'custom') byId('accounting').value = event.target.value;
});
byId('accounting').addEventListener('input', () => { byId('accounting-preset').value = 'custom'; });
form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('reset', () => setTimeout(render, 0));
slider.addEventListener('input', updateChartCursor);
chart.addEventListener('click', event => {
  if (!chartState) return;
  const point = chart.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const { x } = point.matrixTransform(chart.getScreenCTM().inverse());
  const fraction = Math.min(1, Math.max(0, (x - box.left) / (box.right - box.left)));
  slider.value = String(Math.round(fraction * Number(slider.max)));
  updateChartCursor();
});
render();
