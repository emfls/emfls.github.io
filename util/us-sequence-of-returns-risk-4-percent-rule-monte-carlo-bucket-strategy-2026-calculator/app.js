import { compare } from './model.mjs';

const element = id => document.getElementById(id);
const form = element('simulator');
const withdrawalInput = element('withdrawal');
const unit = element('withdrawal-unit');
const portfolioInput = element('portfolio');
const yearInput = element('chart-year');
const chart = element('trajectory');
const shocks = [element('shock-1'), element('shock-2'), element('shock-3')];

const series = [
  { key: 'bear', name: 'Bear-first · Fixed' },
  { key: 'bull', name: 'Bull-first · Fixed' },
  { key: 'guardrails', name: 'Bear-first · Guardrails' },
  { key: 'cashBucket', name: 'Bear-first · Cash bucket' }
];
const plot = { left: 73, right: 414, top: 17, bottom: 210 };
const scenarioNotes = {
  CUSTOM_BEAR_FIRST: 'Three editable loss years, followed by a modeled recovery.',
  EARLY_CRASH_2000: '2000–02 S&P 500 total returns, then a modeled recovery.',
  EARLY_CRASH_2008: '2008–10 S&P 500 total returns, including the 2009 rebound.',
  STAGFLATION_1973: '1973–75 S&P 500 total returns. Use the inflation field to test higher prices.'
};
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const compactDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1
});
const exactDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2
});
const formatMoney = value => dollars.format(Math.abs(value) < .5 ? 0 : value);
const formatPercent = value => percent.format(value);
let previousUnit = unit.value;
let projection;
let chartScale;

function svgElement(tag, attributes, content) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (content !== undefined) node.textContent = content;
  return node;
}

function drawChart() {
  const horizon = projection.returns.length;
  const peak = Math.max(...series.flatMap(({ key }) => projection[key].rows.map(row => row.endingBalance)));
  const magnitude = 10 ** Math.floor(Math.log10(peak / 4));
  const unitStep = [1, 2, 2.5, 5, 10].find(step => 4 * step * magnitude >= peak);
  const ceiling = 4 * unitStep * magnitude;
  const x = year => plot.left + (plot.right - plot.left) * year / horizon;
  const y = balance => plot.bottom - (plot.bottom - plot.top) * balance / ceiling;
  chartScale = { x, y };

  const guides = [];
  for (let i = 0; i <= 4; i++) {
    const value = ceiling * i / 4;
    guides.push(
      svgElement('line', { class: 'guide', x1: plot.left, x2: plot.right, y1: y(value), y2: y(value) }),
      svgElement('text', { x: plot.left - 8, y: y(value) + 4, 'text-anchor': 'end' }, compactDollars.format(value))
    );
  }
  const tickYears = [0, Math.round(horizon / 3), Math.round(2 * horizon / 3), horizon];
  for (const year of tickYears) {
    guides.push(svgElement('text', { x: x(year), y: plot.bottom + 24, 'text-anchor': 'middle' }, `Yr ${year}`));
  }
  element('gridlines').replaceChildren(...guides);
  element('series-lines').replaceChildren(...series.map(({ key }) => {
    const points = projection[key].rows.map(row => `${x(row.year)},${y(row.endingBalance)}`).join(' ');
    return svgElement('polyline', { class: `series ${key}`, points });
  }));

  yearInput.max = horizon;
  renderSelectedYear();
}

function renderSelectedYear() {
  if (!projection) return;
  const year = yearInput.valueAsNumber;
  const yearLabel = year === 0 ? 'starting balance' : `year ${year}`;
  element('selected-year').textContent = yearLabel;
  yearInput.setAttribute('aria-valuetext', yearLabel);

  const { x, y } = chartScale;
  const marker = svgElement('line', { class: 'cursor', x1: x(year), x2: x(year), y1: plot.top, y2: plot.bottom });
  const markers = [marker];
  const details = series.map(({ key, name }) => {
    const row = projection[key].rows[year];
    markers.push(svgElement('circle', { class: key, cx: x(year), cy: y(row.endingBalance), r: 4.5 }));

    const group = document.createElement('div');
    group.className = key;
    const label = document.createElement('dt');
    label.textContent = name;
    const values = document.createElement('dd');
    const parts = [`${formatMoney(row.endingBalance)} balance`];
    if (year > 0) {
      parts.push(`${formatPercent(row.rate)} stock return`, `${formatMoney(row.withdrawn)} withdrawn`);
      if (row.cut) parts.push('spending cut');
      if (row.shortfall >= .005) parts.push(`${exactDollars.format(row.shortfall)} spending shortfall`);
    }
    if (key === 'cashBucket') {
      parts.push(`${formatMoney(row.cash)} cash remaining`);
      if (row.cashWithdrawal > 0) parts.push(`${formatMoney(row.cashWithdrawal)} spent from cash`);
      if (row.refill > 0) parts.push(`${formatMoney(row.refill)} refilled`);
    }
    values.textContent = parts.join(' · ');
    group.append(label, values);
    return group;
  });
  element('year-detail').replaceChildren(...details);
  element('year-marker').replaceChildren(...markers);
}

function fillStrategyCards(horizon) {
  const cards = series.map(({ key, name }) => {
    const outcome = projection[key];
    const card = document.createElement('article');
    card.className = `strategy ${key}`;
    const title = document.createElement('h3');
    title.textContent = name;
    const balance = document.createElement('strong');
    balance.textContent = formatMoney(outcome.endingBalance);
    const status = document.createElement('p');
    if (outcome.depletionYear === null) {
      status.textContent = `Funded through year ${horizon}`;
    } else {
      status.className = 'depleted';
      status.textContent = `Depleted in year ${outcome.depletionYear}`;
      if (outcome.firstShortfallYear === null) {
        status.textContent += ' · Final withdrawal paid';
      } else if (outcome.firstShortfallYear !== outcome.depletionYear) {
        status.textContent += ` · First shortfall in year ${outcome.firstShortfallYear}`;
      }
    }
    card.append(title, balance, status);
    return card;
  });
  element('strategy-cards').replaceChildren(...cards);
}

function render() {
  const scenario = element('scenario').value;
  const isCustom = scenario === 'CUSTOM_BEAR_FIRST';
  element('scenario-note').textContent = scenarioNotes[scenario];
  element('custom-shocks').hidden = !isCustom;
  for (const input of shocks) input.disabled = !isCustom;

  const portfolio = portfolioInput.valueAsNumber;
  const isDollars = unit.value === 'dollars';
  withdrawalInput.max = isDollars && portfolioInput.validity.valid ? portfolio : 100;
  withdrawalInput.labels[0].textContent = `Year-one withdrawal (${isDollars ? '$' : '%'})`;
  const equivalent = element('withdrawal-equivalent');
  const error = element('input-error');
  const invalid = [...form.elements].find(control => control.willValidate && !control.validity.valid);
  if (invalid) {
    projection = undefined;
    element('results').hidden = true;
    equivalent.textContent = '';
    error.textContent = `${invalid.labels[0].textContent} · ${invalid.validationMessage}`;
    error.hidden = false;
    return;
  }

  const withdrawal = isDollars ? withdrawalInput.valueAsNumber : withdrawalInput.valueAsNumber / 100 * portfolio;
  equivalent.textContent = isDollars ? `${formatPercent(withdrawal / portfolio)} of portfolio` : `${formatMoney(withdrawal)} scheduled`;
  const years = element('years').valueAsNumber;
  projection = compare({
    portfolio, withdrawal, years, scenario,
    inflation: element('inflation').valueAsNumber / 100,
    guardrailCut: element('guardrail-cut').valueAsNumber / 100,
    cashYears: element('cash-years').valueAsNumber,
    customShocks: shocks.map(input => input.valueAsNumber / 100)
  });

  element('ending-gap').textContent = formatMoney(projection.gap);
  element('cagr').textContent = formatPercent(projection.cagr);
  element('safe-rate').textContent = formatPercent(projection.safeRate);
  fillStrategyCards(years);
  drawChart();
  error.hidden = true;
  element('results').hidden = false;
}

form.addEventListener('input', () => {
  if (unit.value !== previousUnit) {
    const portfolio = portfolioInput.valueAsNumber;
    const amount = withdrawalInput.valueAsNumber;
    if (portfolioInput.validity.valid && Number.isFinite(amount)) {
      const converted = unit.value === 'dollars' ? amount / 100 * portfolio : amount / portfolio * 100;
      const upperLimit = unit.value === 'dollars' ? portfolio : 100;
      const priorLimit = unit.value === 'dollars' ? 100 : portfolio;
      withdrawalInput.value = amount === priorLimit ? upperLimit : Number(converted.toPrecision(15));
    }
    previousUnit = unit.value;
  }
  render();
});

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('reset', () => {
  setTimeout(() => {
    previousUnit = unit.value;
    yearInput.value = yearInput.defaultValue;
    render();
  }, 0);
});
yearInput.addEventListener('input', renderSelectedYear);

function inspectChart(event) {
  if (!projection) return;
  const transform = chart.getScreenCTM();
  if (!transform) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
  const horizon = projection.returns.length;
  const year = Math.max(0, Math.min(horizon, Math.round(horizon * (point.x - plot.left) / (plot.right - plot.left))));
  if (year !== yearInput.valueAsNumber) {
    yearInput.value = year;
    renderSelectedYear();
  }
}
chart.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse') inspectChart(event);
});
chart.addEventListener('click', inspectChart);

render();
