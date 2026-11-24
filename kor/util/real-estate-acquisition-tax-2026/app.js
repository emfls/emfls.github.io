import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const fields = form.elements;
const numberFormat = new Intl.NumberFormat('ko-KR');
const percentFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const won = value => numberFormat.format(value) + '원';
const names = {
  standard: '감면 미적용',
  first: '생애최초 감면 적용',
  birth: '출산·양육 감면 적용',
};
const chartKeys = ['acquisition', 'education', 'rural'];

function setText(id, value) {
  byId(id).textContent = value;
}

function readPrice() {
  const value = fields.price.value.trim();
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)
    ? Number(value.replaceAll(',', ''))
    : NaN;
}

function readArea() {
  const value = fields.area.value.trim();
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ? Number(value) : NaN;
}

function compare(key, estimate, status, selected) {
  const row = byId('row-' + key);
  row.classList.toggle('selected', selected);
  setText('status-' + key, status);
  setText('total-' + key, estimate ? won(estimate.total) : '—');
  if (key !== 'standard') setText('relief-' + key, estimate ? won(estimate.relief) : '—');
}

function renderChart(selected) {
  let offset = 0;
  for (const key of chartKeys) {
    const width = selected?.total ? 400 * selected[key] / selected.total : 0;
    const bar = byId('bar-' + key);
    bar.setAttribute('x', offset);
    bar.setAttribute('width', width);
    offset += width;
  }
}

function render() {
  const houses = Number(fields.houses.value);
  const corporate = fields.corporate.checked;
  const canBeTemporary = !corporate && houses === 2;
  fields.houses.disabled = corporate;
  fields.adjusted.disabled = corporate;
  byId('temporary-option').hidden = !canBeTemporary;
  fields.temporary.disabled = !canBeTemporary;
  byId('relief-options').disabled = corporate;
  const smallType = !corporate && fields.smallType.checked;
  byId('metro-option').hidden = !smallType;
  fields.metro.disabled = !smallType;
  const birth = !corporate && fields.birth.checked;
  byId('birth-dates').hidden = !birth;

  const result = calculate({
    price: readPrice(),
    area: readArea(),
    houses,
    adjusted: fields.adjusted.checked,
    temporary: canBeTemporary && fields.temporary.checked,
    corporate,
    ruralTown: fields.ruralTown.checked,
    metro: smallType && fields.metro.checked,
    declining: fields.declining.checked,
    smallType,
    first: !corporate && fields.first.checked,
    birth,
    purchaseDate: fields.purchaseDate.value,
    birthDate: fields.birthDate.value,
  });

  const selected = result?.selected;
  setText('total', selected ? won(selected.total) : '—');
  let note = '취득가액과 전용면적을 양수로 입력하세요. 취득가액은 원 단위의 정수로 입력합니다.';
  if (selected) {
    const rate = percentFormat.format(selected.rateBps / 100);
    note = `취득세율 ${rate}% · ${names[selected.key]}`;
    if (birth && !result.birthInWindow) note += ' · 출산 감면 대상 날짜를 확인하세요.';
  }
  setText('result-note', note);

  setText('gross', selected ? won(selected.grossAcquisition) : '—');
  setText('relief', selected ? (selected.relief ? '−' : '') + won(selected.relief) : '—');
  for (const key of chartKeys) setText(key, selected ? won(selected[key]) : '—');
  renderChart(selected);

  compare('standard', result?.standard, selected?.key === 'standard' ? '적용' : '', selected?.key === 'standard');
  const firstStatus = result?.firstEstimate
    ? `한도 ${result.firstLimit / 10_000}만 원${selected.key === 'first' ? ' · 적용' : ''}`
    : result ? '비교 요건 미충족' : '';
  compare('first', result?.firstEstimate, firstStatus, selected?.key === 'first');
  const birthStatus = result?.birthEstimate
    ? '한도 500만 원' + (selected.key === 'birth' ? ' · 적용' : '')
    : result ? '비교 요건 미충족' : '';
  compare('birth', result?.birthEstimate, birthStatus, selected?.key === 'birth');
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
fields.price.addEventListener('blur', () => {
  const value = readPrice();
  if (Number.isSafeInteger(value) && value > 0) fields.price.value = numberFormat.format(value);
});
render();
