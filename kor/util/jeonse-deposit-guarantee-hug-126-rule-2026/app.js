import { calculate, parseManwon } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const fields = form.elements;
const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const won = value => `${number.format(value)}원`;
const set = (id, value) => { byId(id).textContent = value; };

function setPriceBasis(changeType) {
  const type = fields.namedItem('type').value;
  const basis = fields.namedItem('basis');
  const market = basis.querySelector('[value="market"]');
  const published = basis.querySelector('[value="published"]');
  market.disabled = type === 'villa';
  published.textContent = type === 'officetel' ? '국세청 오피스텔 기준시가' : '공동주택 공시가격';
  if (changeType) basis.value = type === 'villa' ? 'published' : 'market';

  set('price-label', basis.selectedOptions[0].textContent);
  let hint = '보증승인일에 적용되는 공시가격을 입력하세요.';
  if (basis.value === 'market') {
    hint = type === 'officetel' ? '해당 호실 시세의 하한가를 입력하세요.'
      : '시세 상·하한가의 평균을 입력하세요. 최저층은 하한가입니다.';
  } else if (type === 'officetel') {
    hint = '시세 순위가 적용되지 않을 때 국세청 기준시가를 입력하세요.';
  }
  set('price-note', hint);
}

function update() {
  const data = new FormData(form);
  const read = name => data.get(name).trim();
  const amount = name => parseManwon(read(name));
  const daysText = read('days');
  const conversionText = read('conversion');
  const result = calculate({
    type: read('type'),
    basis: read('basis'),
    region: read('region'),
    price: amount('price'),
    deposit: amount('deposit'),
    senior: amount('senior'),
    days: /^\d+$/.test(daysText) ? Number(daysText) : NaN,
    social: Number(read('social')),
    mobile: data.has('mobile'),
    support: read('support'),
    supportCap: Number(read('supportCap')),
    conversion: conversionText === '' || /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(conversionText)
      ? Number(conversionText) : NaN
  });
  const showSupport = read('support') !== 'none';
  byId('cap-field').hidden = !showSupport;
  byId('results').hidden = !result;

  if (!result) {
    byId('badge').dataset.state = 'empty';
    set('badge', '입력값 확인');
    set('reason', '가격과 보증금은 0보다 큰 금액, 계약기간은 1~3,650일의 정수로 입력하세요. 선순위채권이 없으면 0을 입력하세요.');
    return;
  }

  const failures = [];
  if (!result.collateralPass) {
    const rule = read('basis') === 'published' ? '126%' : '90%';
    failures.push(`합산 ${rule} 한도 초과 위험`);
  }
  if (!result.seniorPass) failures.push(`선순위채권 한도 초과(${won(result.seniorReduction)})`);
  if (!result.regionPass) failures.push('지역별 보증금 상한 초과');

  byId('badge').dataset.state = result.eligible ? 'pass' : 'fail';
  set('badge', result.eligible ? '가입 가능 · 금액 기준 충족' : '가입 기준 미충족 · 거절 위험');
  set('reason', result.eligible ? '금액 조건 3개 충족. HUG의 서류·권리 심사가 남아 있습니다.'
    : failures.join(' · '));

  const gauge = byId('gauge');
  gauge.setAttribute('width', 296 * Math.min(result.debtRatio / 125, 1));
  gauge.setAttribute('fill', result.collateralPass ? '#086154' : '#982d1f');
  const capLabel = read('basis') === 'published' ? '공시 기준 126%' : '시세 90%';
  set('gauge-text', `합산 한도 사용률 ${number.format(result.debtRatio)}% · 세로선은 ${capLabel} 한도(사용률 100%)입니다.`);

  set('house-price', won(result.housePrice));
  set('gross-limit', won(result.grossLimit));
  set('senior-limit', won(result.seniorLimit));
  set('region-limit', won(result.regionLimit));
  set('deposit-limit', won(result.depositLimit));
  set('delta-label', result.depositDelta < 0 ? '보증금 감액 필요액' : '금액상 보증금 여유');
  set('deposit-delta', won(Math.abs(result.depositDelta)));

  const rent = byId('rent');
  rent.hidden = result.monthlyRent === null;
  if (!rent.hidden) {
    rent.textContent = `감액분을 입력한 전환율로 바꾸면 월세 약 ${won(result.monthlyRent)}입니다. HUG는 반전세 계약의 환산 보증금을 별도로 심사합니다.`;
  }
  set('fee', result.estimatedFee === null ? '산정 보류' : won(result.estimatedFee));
  const rate = (result.rateUnits / 1000).toFixed(3);
  set('fee-detail', result.eligible
    ? `연 ${rate}% · 할인·할증 전 ${won(result.baseFee)}${result.surcharge ? ' · 선순위채권 10% 할증 반영' : ''}`
    : '가입 금액 조건을 충족하면 예상 보증료를 표시합니다.');

  const refund = byId('refund');
  refund.hidden = !showSupport || !result.eligible;
  if (!refund.hidden) {
    refund.textContent = result.refund === null
      ? '보증금이 3억 원을 초과해 보증료 지원 금액 기준을 충족하지 않습니다.'
      : `예상 환급 ${won(result.refund)} · 환급 후 예상 부담 ${won(result.netCost)} (지자체 승인 시)`;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === fields.namedItem('type') || event.target === fields.namedItem('basis')) {
    setPriceBasis(event.target === fields.namedItem('type'));
    // The previous price describes a different property type or valuation source.
    fields.namedItem('price').value = '';
  }
  update();
});
setPriceBasis(false);
update();
