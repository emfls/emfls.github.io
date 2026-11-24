import {calculateGiftTax} from './model.mjs';

export function summarize(form) {
  const result = calculateGiftTax({
    amount: Number(form.get('amount')), relation: form.get('relation'),
    basicUsed: Number(form.get('basicUsed')), event: form.get('event'),
    eventUsed: Number(form.get('eventUsed')), skipping: form.has('skipping'),
    timely: form.has('timely'), priorAggregation: form.has('priorAggregation'),
  });
  const won = value => value.toLocaleString('ko-KR') + '원';
  return [
    ['예상 납부세액', won(result.total)],
    ['사용 가능한 총 공제 한도', won(result.basicRemaining + result.eventRemaining)],
    ['이번 증여 전 기본공제 잔액', won(result.basicRemaining)],
    ['이번 증여에 적용한 기본공제', won(result.basicApplied)],
    ['이번 증여에 적용한 혼인·출산 공제', won(result.eventApplied)],
    ['과세표준', won(result.taxBase)], ['산출세액', won(result.baseTax)],
    ['세대생략 할증 (' + result.surchargeRate + '%)', won(result.surcharge)],
    ['기한 내 신고세액공제', won(result.filingCredit)],
  ];
}

const form = document.querySelector('#calculator');
const result = document.querySelector('#result');
form.addEventListener('input', () => { result.replaceChildren(); });
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const rows = summarize(new FormData(form));
    const list = document.createElement('dl');
    for (const [label, value] of rows) {
      const term = document.createElement('dt');
      const definition = document.createElement('dd');
      term.textContent = label;
      definition.textContent = value;
      list.append(term, definition);
    }
    result.replaceChildren(list);
  } catch (error) {
    result.textContent = error instanceof RangeError ? error.message :
      "입력값을 확인하고 다시 계산하세요.";
  }
});
