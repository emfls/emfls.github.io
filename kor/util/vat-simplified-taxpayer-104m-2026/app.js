import { calculateVat, parseWon, CARD_NET_SALES_LIMIT } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const fields = form.elements;
const format = new Intl.NumberFormat('ko-KR');
const won = value => format.format(value) + '원';
const show = (id, message) => { byId(id).textContent = message; };
const amountFields = {
  priorSales: '직전 연도 공급대가',
  sales: '이번 과세 매출',
  purchases: '적격증빙 매입액',
  cardSales: '카드·현금영수증 발행액',
  priorNetSales: '직전 연도 사업장 공급가액',
  remainingCardCap: '연간 발행공제 잔여 한도',
  months: '적용 개월 수',
};

function renderTax(prefix, tax) {
  show(prefix + '-net', won(Math.abs(tax.net)));
  show(prefix + '-status', tax.net < 0 ? '예상 환급' : '예상 납부');
  show(prefix + '-output', won(tax.outputTax));
  show(prefix + '-input', won(tax.inputCredit));
  show(prefix + '-card', won(tax.cardCredit));
}

function renderChart(simple, general) {
  const maximum = Math.max(1, Math.abs(simple), Math.abs(general));
  for (const [key, value] of [['simple', simple], ['general', general]]) {
    const width = Math.abs(value) / maximum * 133;
    const bar = byId(key + '-bar');
    bar.setAttribute('x', value < 0 ? 150 - width : 150);
    bar.setAttribute('width', width);
  }
  const describe = value => (value < 0 ? '환급 ' : '납부 ') + won(Math.abs(value));
  show('chart-description', '간이과세자 ' + describe(simple) + ', 일반과세자 ' + describe(general));
}

function update() {
  let input;
  let result;
  try {
    input = Object.fromEntries(Object.entries(amountFields).map(([name, label]) => {
      try {
        return [name, parseWon(fields[name].value)];
      } catch (error) {
        throw new RangeError(label + ' · ' + error.message);
      }
    }));
    result = calculateVat({
      ...input,
      industry: fields.industry.value,
      cardEligibility: fields.cardEligibility.value,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    byId('results').hidden = true;
    show('feedback', error.message);
    return;
  }

  const typeLimit = result.typeLimit === 104_000_000 ? '1억 400만 원' : '4,800만 원';
  show('type-badge', typeLimit + (result.belowTypeLimit ? ' 미만 · 간이과세 매출 요건 충족' : ' 이상 · 일반과세 전환 기준 도달'));
  show('exemption-badge', result.exempt ? '4,800만 원 미만 · 간이 납부면제 구간' : '4,800만 원 이상 · 간이 납부면제 기준 제외');
  byId('type-badge').dataset.warning = String(!result.belowTypeLimit);
  byId('exemption-badge').dataset.warning = String(!result.exempt);
  show('scenario-note', result.belowTypeLimit
    ? '과세유형은 업종·지역별 배제 요건과 홈택스 사업자 정보를 함께 확인하세요.'
    : '간이과세 결과는 비교용입니다. 직전 연도 기준 충족 여부에 따라 그 다음 해 7월 1일부터 적용되는 과세유형을 확인하세요.');
  show('period-note', input.months === 12 ? '납부면제 판정 매출 ' + won(input.sales)
    : '납부면제 판정용 12개월 환산 매출 ' + won(result.annualizedSales) + ' · 세액은 입력한 기간의 실제 매출로 계산');
  show('credit-note', input.priorNetSales > CARD_NET_SALES_LIMIT
    ? '직전 연도 사업장 공급가액이 10억 원을 초과해 일반과세 발행공제는 0원입니다.' : '');
  renderTax('simple', result.simple);
  renderTax('general', result.general);
  if (result.exempt) show('simple-status', '납부면제 구간');
  if (result.general.net < 0) {
    show('difference', '일반과세는 적격 매입세액이 매출세액보다 커 환급이 예상됩니다. 간이과세에서는 매입 공제 초과액이 환급되지 않습니다.');
  } else {
    const difference = result.general.net - result.simple.net;
    const lower = difference > 0 ? '간이과세' : '일반과세';
    show('difference', difference === 0 ? '두 유형의 예상 납부액이 같습니다.'
      : lower + '의 시뮬레이션 납부액이 ' + won(Math.abs(difference)) + ' 적습니다.');
  }
  renderChart(result.simple.net, result.general.net);
  show('feedback', '');
  byId('results').hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('focusout', event => {
  if (!Object.hasOwn(amountFields, event.target.name) || event.target.name === 'months') return;
  try {
    event.target.value = format.format(parseWon(event.target.value));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
});
update();
