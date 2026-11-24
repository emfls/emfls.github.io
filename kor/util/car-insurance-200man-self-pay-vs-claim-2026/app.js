import { calculate } from './model.mjs';

const form = document.querySelector('#estimate');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const formatter = new Intl.NumberFormat('ko-KR');
const won = amount => `${formatter.format(amount)}원`;
const set = (id, value) => { document.getElementById(id).textContent = value; };

const choices = { claim: '보험처리 유리', selfPay: '자비처리 유리', tie: '두 방법의 비용이 같아요' };
const repaymentChoices = { keep: '보험 유지 유리', repay: '환입 유리', tie: '환입과 보험 유지 비용 동일', none: '환입 대상 없음' };

function render() {
  const fields = [...form.querySelectorAll('input, select')];
  const invalid = fields.find(field => !field.validity.valid);
  for (const field of fields) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }
  results.hidden = Boolean(invalid);
  if (invalid) {
    const label = invalid.labels[0].textContent.trim();
    status.textContent = `${label} 항목에 입력 범위에 맞는 숫자를 넣어 주세요.`;
    return;
  }

  const input = Object.fromEntries(fields.map(field => [field.name, Number(field.value)]));
  const result = calculate(input);
  const equalOrLess = result.score === 0.5;
  status.textContent = `${choices[result.choice]} · 3년 비용 차이 ${won(Math.abs(result.difference))}`;
  set('score', result.score > 0
    ? `${result.score}점 · 지급액이 기준 ${won(input.threshold)} ${equalOrLess ? '이하' : '초과'}`
    : '0점 · 보험사 지급액 없음');
  set('rate', `반영한 연간 할증률 ${formatter.format(result.effectiveSurchargeRate)}%`);
  set('payout', won(result.payout));
  set('deductible', won(result.deductible));
  set('surcharge', won(result.surchargeCost));
  set('lost-discount', won(result.lostDiscountCost));
  set('repayment-choice', repaymentChoices[result.repaymentChoice]);
  set('repayment-principal', won(result.repaymentPrincipal));
  set('premium-savings', won(result.premiumSavings));
  set('break-even', result.score > 0 ? won(result.premiumSavings) : '지급액 없음');

  const { half, full } = result.breakEvenByScore;
  set('half-break-even', won(half));
  set('full-break-even', won(full));
  set('half-rule', half >= input.threshold
    ? '이 구간에서는 보험처리 비용이 자비처리보다 낮아지는 경우가 없습니다.'
    : `지급액이 ${won(half)}을 넘고 ${won(input.threshold)} 이하면 보험처리가 유리합니다.`);
  set('full-rule', full <= input.threshold
    ? `지급액이 ${won(input.threshold)}을 넘는 이 구간에서는 보험처리가 유리합니다.`
    : `이 구간에서 지급액이 ${won(full)}을 넘으면 보험처리가 유리합니다.`);

  const costs = { 'self-pay': result.selfPayCost, claim: result.claimCost, repayment: result.repaymentCost };
  const maximum = Math.max(1, ...Object.values(costs));
  for (const [name, amount] of Object.entries(costs)) {
    set(`${name}-cost`, won(amount));
    document.getElementById(`${name}-bar`).setAttribute('width', 100 * amount / maximum);
  }
  for (const year of result.years) {
    set(`year-${year.year}-self`, won(year.selfPayPremium));
    set(`year-${year.year}-claim`, won(year.claimPremium));
    set(`year-${year.year}-gap`, won(year.premiumDifference));
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('reset', () => queueMicrotask(render));
render();
