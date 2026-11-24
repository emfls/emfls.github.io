import { calculate, PROVINCES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const compact = new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', signDisplay: 'exceptZero' });
const money = value => cad.format(Math.abs(value) < 0.005 ? 0 : value);
const set = (id, text) => { byId(id).textContent = text; };

function showField(id, visible) {
  const field = byId(id);
  field.hidden = !visible;
  for (const input of field.querySelectorAll('input, select')) input.disabled = !visible;
}

function inputsFromForm() {
  const account = byId('account').value;
  const province = byId('province').value;
  const distribution = byId('distribution').value;
  const corporate = account === 'CCPC_CORP';
  const includeOas = !corporate && byId('includeOas').checked;
  showField('withholding-field', distribution === 'US_FOREIGN_DIV');
  showField('ordinary-field', !corporate);
  showField('eligible-field', !corporate && distribution === 'CANADIAN_ELIGIBLE_DIV');
  showField('aaii-field', corporate);
  showField('oas-field', !corporate);
  showField('oas-inputs', includeOas);

  const inputs = { account, province, distribution, includeOas, withholding: byId('withholding').value };
  for (const input of form.querySelectorAll('input[type="number"]:not(:disabled)')) {
    if (!input.validity.valid) {
      throw new RangeError(`${input.labels[0].textContent} — ${input.validationMessage}`);
    }
    inputs[input.id] = input.valueAsNumber;
  }
  return inputs;
}

function svg(tag, attributes, label) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (label !== undefined) element.textContent = label;
  return element;
}

function drawChart(rows) {
  const years = rows.length - 1;
  const highest = Math.max(1, ...rows.flatMap(({ swap, regular }) => [swap.net, regular.net]));
  const scale = 10 ** Math.floor(Math.log10(highest / 4));
  const tick = Math.ceil(highest / (4 * scale)) * scale;
  const left = 72;
  const right = 522;
  const top = 18;
  const bottom = 227;
  const x = year => left + (right - left) * year / years;
  const y = value => bottom - (bottom - top) * value / (4 * tick);
  const plot = svg('g', { 'data-plot': '', 'font-size': 15, fill: '#334155' });
  for (let index = 0; index <= 4; index++) {
    const value = index * tick;
    plot.append(
      svg('line', { x1: left, x2: right, y1: y(value), y2: y(value), stroke: '#d8e2f0' }),
      svg('text', { x: left - 8, y: y(value) + 5, 'text-anchor': 'end' }, '$' + compact.format(value)),
    );
    const year = Math.round(years * index / 4);
    plot.append(svg('text', { x: x(year), y: 250, 'text-anchor': 'middle' }, 'Yr ' + year));
  }
  for (const [key, color, dash] of [['swap', '#174cab', 'none'], ['regular', '#9a4005', '7 5']]) {
    const points = rows.map(row => `${x(row.year)},${y(row[key].net)}`).join(' ');
    plot.append(svg('polyline', { points, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-dasharray': dash }));
  }

  const chart = byId('chart');
  chart.querySelector('[data-plot]')?.remove();
  chart.append(plot);
  const last = rows.at(-1);
  set('chart-desc', `At year ${years}, modeled after-tax proceeds are ${money(last.swap.net)} for the swap ETF and ${money(last.regular.net)} for the distributing ETF.`);
}

function renderBreakdown(final, corporate, includeOas) {
  const lines = [
    ['Value before sale', 'value'],
    ['Adjusted cost base', 'acb'],
    ['Capital gain or loss', 'gain'],
    ['Income tax on sale', 'saleTax'],
  ];
  if (includeOas) lines.push(['Additional OAS recovery on sale', 'saleOas']);
  lines.push(['After-tax proceeds', 'net']);
  if (corporate) lines.push(
    ['Annual distribution AAII', 'annualAaii'],
    ['Additional AAII from sale', 'saleAaii'],
    ['Federal business limit without sale', 'holdingBusinessLimit'],
    ['Federal business limit after sale-year AAII', 'saleBusinessLimit'],
    ['Potential capital dividend account addition', 'cdaCredit'],
  );
  const rows = lines.map(([label, key]) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const holding of [final.swap, final.regular]) {
      const cell = document.createElement('td');
      cell.textContent = money(holding[key]);
      row.append(cell);
    }
    return row;
  });
  byId('breakdown').replaceChildren(...rows);
}

function update() {
  let inputs;
  let results;
  try {
    inputs = inputsFromForm();
    results = calculate(inputs);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    set('error', error.message);
    set('result-status', 'Enter a valid scenario to see results.');
    byId('error').hidden = false;
    byId('results').hidden = true;
    return;
  }

  const { rows, final, advantage, averageAnnualTax, averageAnnualTaxRate, averageAnnualAaii, breakeven } = results;
  const corporate = inputs.account === 'CCPC_CORP';
  const difference = Math.abs(advantage) < 0.005 ? 0 : advantage;
  const status = difference === 0
    ? 'Both ETFs finish at the same modeled value to the nearest cent.'
    : `${difference > 0 ? 'The swap ETF' : 'The distributing ETF'} leads by ${money(Math.abs(difference))} after ${final.year} years.`;

  set('result-status', status);
  set('swap-net', money(final.swap.net));
  set('regular-net', money(final.regular.net));
  set('advantage', signed.format(difference));
  set('tax-drag', `${money(averageAnnualTax)}/yr · ${averageAnnualTaxRate.toFixed(2)}%/yr`);
  set('breakeven', breakeven === null ? 'No lead in 30 years' : `Year ${breakeven}`);
  byId('aaii-result').hidden = !corporate;
  if (corporate) set('annual-aaii', `${money(averageAnnualAaii)}/yr`);
  renderBreakdown(final, corporate, inputs.includeOas);
  drawChart(rows);
  byId('error').hidden = true;
  byId('results').hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === byId('province')) {
    const { ordinaryRate, eligibleRate } = PROVINCES[event.target.value];
    byId('ordinaryRate').value = ordinaryRate.toFixed(2);
    byId('eligibleRate').value = eligibleRate.toFixed(2);
  }
  update();
});
update();
