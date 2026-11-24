import { limits, simulate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('inputs');
const results = byId('results');
const chartPanel = byId('chart-panel');
const error = byId('input-error');
const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const inputNumber = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 });
const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const money = (amount) => `${number.format(amount)}원`;
const yearsFromNow = (offset) => offset === 0 ? '지금' : `${offset}년 후`;
const put = (id, value) => { byId(id).textContent = value; };

const wonFields = ['monthlyWage', 'annualExtras', 'dailyOrdinaryWage'];
const rateFields = ['wageGrowth', 'peakCut', 'dcReturn'];
const inputLabels = Array.from(form.querySelectorAll('input'), (element) => {
  const key = element.name;
  const factor = wonFields.includes(key) ? 10_000 : rateFields.includes(key) ? 0.01 : 1;
  return {
    key, element, factor,
    label: element.closest('label').firstElementChild.textContent,
    unit: element.nextElementSibling.textContent,
  };
});

function parseNumber(text) {
  const cleaned = text.trim();
  const numeric = /^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/;
  return numeric.test(cleaned) ? Number(cleaned.replaceAll(',', '')) : NaN;
}

function readInput() {
  const input = {};
  const errors = [];
  for (const { key, element, factor, label, unit } of inputLabels) {
    const value = parseNumber(element.value);
    const [min, max, integer] = limits[key];
    const visibleMin = min / factor;
    const visibleMax = max / factor;
    const dynamicMax = key === 'peakYears' && Number.isInteger(input.years) ?
      Math.min(visibleMax, input.years) : visibleMax;
    const valid = Number.isFinite(value) && value >= visibleMin && value <= dynamicMax &&
      (!integer || Number.isInteger(value));
    element.setAttribute('aria-invalid', String(!valid));
    if (valid) {
      input[key] = factor === 0.01 ? value / 100 : value * factor;
    } else {
      errors.push(`${label} 입력 범위는 ${inputNumber.format(visibleMin)}~${inputNumber.format(dynamicMax)}${unit}입니다.${integer ? ' 정수로 입력하세요.' : ''}`);
    }
  }
  return { input, errors };
}

function thresholdText(threshold) {
  if (threshold.kind === 'root') {
    const value = threshold.rate * 100;
    const text = value !== 0 && Math.abs(value) < 0.005
      ? (value > 0 ? '0% 초과~0.01% 미만' : '-0.01% 초과~0% 미만')
      : `${decimal.format(value)}%`;
    return `손익분기 연 ${text}`;
  }
  return {
    equal: '모든 수익률에서 DB와 동일',
    above: '모든 수익률에서 DB보다 높음',
    below: '모든 수익률에서 DB보다 낮음',
  }[threshold.kind];
}

function renderCard(prefix, scenario, note) {
  put(`${prefix}-amount`, scenario ? money(scenario.total) : '해당 없음');
  put(`${prefix}-note`, note);
  const badge = byId(`${prefix}-threshold`);
  badge.hidden = !scenario;
  badge.textContent = scenario ? thresholdText(scenario.threshold) : '';
}

function renderResults(result, input) {
  const { db, dbReduction, now, peak, bestSwitch } = result;
  const { years, peakYears } = input;
  put('db-amount', money(db));
  put('db-note', `총 근속 ${decimal.format(input.pastDays / 365 + years)}년 기준`);
  renderCard('now', now, `과거분 이전액 ${money(now.settlement)}`);
  renderCard('peak', peak, peak
    ? `${yearsFromNow(peak.offset)} 전환 · 과거분 ${money(peak.settlement)}`
    : '임금피크제 적용 기간이 0년입니다.');

  const gap = Math.round(bestSwitch.total - db);
  const bestAmount = money(Math.max(db, bestSwitch.total));
  const { offsets } = bestSwitch;
  const timing = offsets.length === years && years > 1 ? '모든 비교 시점' :
    offsets.length > 4 ? `${yearsFromNow(offsets[0])} 등 ${offsets.length}개 시점` :
      offsets.map(yearsFromNow).join(' · ');
  if (gap === 0) put('answer-live', `입력한 조건에서 DB 유지와 가장 높은 DC 전환안의 예상액이 같습니다. 약 ${bestAmount}입니다.`);
  else if (gap < 0) put('answer-live', `입력한 조건에서는 DB 유지가 가장 높습니다. 예상액은 ${bestAmount}입니다.`);
  else put('answer-live', `입력한 조건에서 최고 예상액은 ${bestAmount}입니다. DC 전환 시점은 ${timing}이며, DB 유지보다 ${money(gap)} 많습니다.`);

  put('best-switch', `DC 전환 시점 중 최고 예상액은 ${money(bestSwitch.total)}이며, 해당 시점은 ${timing}입니다.`);

  let warning = '임금피크제를 적용하지 않아 피크제로 인한 DB 감소액은 0원입니다.';
  if (peakYears > 0) {
    const difference = Math.round(peak.total - db);
    const comparison = difference === 0 ? 'DB 유지액과 같습니다.' :
      `DB 유지액보다 ${money(Math.abs(difference))} ${difference > 0 ? '많습니다.' : '적습니다.'}`;
    const reduction = Math.round(dbReduction) === 0 ? 'DB 유지액은 그대로입니다.' :
      `DB 유지액은 ${money(dbReduction)} 줄어듭니다.`;
    warning = `피크제가 없고 임금이 계속 오르는 경우와 비교하면 ${reduction} 피크제 직전 DC 전환안은 ${comparison}`;
  }
  put('risk-live', warning);
}

const svgNamespace = 'http://www.w3.org/2000/svg';

function svgElement(tag, attributes, text) {
  const element = document.createElementNS(svgNamespace, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderChart({ timeline, peak }) {
  const series = [
    { key: 'db', color: 'var(--db)', dash: '8 5' },
    { key: 'now', color: 'var(--dc)', dash: '' },
  ];
  if (peak) series.push({ key: 'peak', color: 'var(--peak)', dash: '2 5' });

  const grid = byId('chart-grid');
  const lines = byId('chart-lines');
  grid.replaceChildren();
  lines.replaceChildren();
  byId('peak-legend').hidden = !peak;
  byId('peak-column').hidden = !peak;
  put('chart-desc', '현재부터 퇴직 시점까지 DB 유지와 DC 전환안의 예상 퇴직급여를 비교합니다. 정확한 금액은 연도별 표에서 확인할 수 있습니다.');

  const years = timeline.length - 1;
  const maximum = Math.max(1, ...timeline.flatMap((row) => series.map(({ key }) => row[key])));
  const scale = 10 ** Math.floor(Math.log10(maximum / 4));
  const axisStep = Math.ceil(maximum / 4 / scale) * scale;
  const x = (offset) => 78 + offset / years * 369;
  const y = (amount) => 202 - amount / (axisStep * 4) * 182;
  const labelStyle = { fill: 'var(--muted)', 'font-size': 15 };

  for (let tick = 0; tick <= 4; tick += 1) {
    const amount = tick * axisStep;
    const height = y(amount);
    grid.append(
      svgElement('line', { x1: x(0), x2: x(years), y1: height, y2: height, stroke: 'var(--line)' }),
      svgElement('text', { ...labelStyle, x: 70, y: height + 5, 'text-anchor': 'end' }, `${compact.format(amount)}원`),
    );
  }
  const tickOffsets = new Set(Array.from({ length: 5 }, (_, index) => Math.round(years * index / 4)));
  for (const offset of tickOffsets) {
    const label = offset === 0 ? '지금' : `${offset}년`;
    grid.append(svgElement('text', { ...labelStyle, x: x(offset), y: 224, 'text-anchor': 'middle' }, label));
  }
  for (const { key, color, dash } of series) {
    const points = timeline.map((row) => `${x(row.offset)},${y(row[key])}`).join(' ');
    lines.append(svgElement('polyline', {
      points, stroke: color, fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'stroke-dasharray': dash,
    }));
  }

  const tableRows = timeline.map((row) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = row.offset === years ? `${years}년 후 (퇴직)` : yearsFromNow(row.offset);
    tr.append(th);
    for (const { key } of series) {
      const td = document.createElement('td');
      td.textContent = decimal.format(row[key] / 10_000);
      tr.append(td);
    }
    return tr;
  });
  byId('timeline').replaceChildren(...tableRows);
}

function update() {
  const { input, errors } = readInput();
  const valid = errors.length === 0;
  error.hidden = valid;
  error.textContent = valid ? '' : errors[0];
  results.hidden = !valid;
  chartPanel.hidden = !valid;
  if (!valid) {
    put('answer-live', '입력을 확인하면 예상 퇴직급여가 표시됩니다.');
    return;
  }
  const result = simulate(input);
  renderResults(result, input);
  renderChart(result);
}

form.addEventListener('input', update);
form.addEventListener('reset', () => queueMicrotask(update));
form.addEventListener('submit', (event) => event.preventDefault());
update();
