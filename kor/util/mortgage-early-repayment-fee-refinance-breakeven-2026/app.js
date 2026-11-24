import { calculateRefinance, estimateElapsedDays, FEE_WINDOW_DAYS, REFORM_RATE } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('loan-form');
const number = id => byId(id).valueAsNumber;
const optionalNumber = id => byId(id).value === '' ? undefined : number(id);
const integers = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const chartAmounts = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const decimals = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const won = amount => `${integers.format(Math.round(amount) || 0)}원`;

function showAmount(id, amount) {
  const field = byId(id);
  field.textContent = won(amount);
  field.classList.toggle('negative', Math.round(amount) < 0);
}

function drawChart(result) {
  const { points, breakEvenMonth } = result;
  const last = points.at(-1);
  const top = Math.max(0, ...points.map(point => point.net));
  const bottom = Math.min(0, ...points.map(point => point.net));
  const span = top - bottom;
  const x = month => 99 + 324 * month / last.month;
  const y = value => span === 0 ? 82 : 20 + (top - value) * 125 / span;
  const zero = byId('zero-line');
  zero.setAttribute('y1', y(0));
  zero.setAttribute('y2', y(0));
  byId('curve').setAttribute('points', points.map(({ month, net }) =>
    `${x(month).toFixed(2)},${y(net).toFixed(2)}`).join(' '));

  const dot = byId('break-even-dot');
  dot.style.display = breakEvenMonth === null ? 'none' : '';
  if (breakEvenMonth !== null) {
    dot.setAttribute('cx', x(breakEvenMonth));
    dot.setAttribute('cy', y(points[breakEvenMonth].net));
  }

  byId('chart-high').textContent = span === 0 ? '' : `${chartAmounts.format(top)}원`;
  byId('chart-low').textContent = span === 0 ? '' : `${chartAmounts.format(bottom)}원`;
  byId('chart-term').textContent = `${last.month}개월`;
  byId('chart-desc').textContent = `실행 직후 ${won(points[0].net)}, 만기 ${won(last.net)}. 손익분기점 ${recoveryLabel(breakEvenMonth)}.`;
}

function recoveryLabel(month) {
  if (month === null) return '만기 내 회수 불가';
  if (month === 0) return '즉시 (0개월)';
  return `${month}개월째`;
}

function showError(message) {
  byId('results').hidden = true;
  byId('error').hidden = false;
  byId('error').textContent = message;
}

function update() {
  const waiver = byId('waiver').checked;
  byId('waiver-fields').hidden = !waiver;
  byId('availableWaiver').disabled = !waiver;
  byId('loading').hidden = true;
  const invalid = [...form.elements].find(field => !field.validity.valid);
  if (invalid) {
    showError(`${invalid.labels[0].textContent} 항목의 값을 확인하세요.`);
    return;
  }

  const balance = Math.round(number('balance') * 10_000);
  const termMonths = number('termMonths');
  const legacyRate = Number(byId('legacyRate').value);
  const elapsedDays = optionalNumber('elapsedDays') ?? estimateElapsedDays(number('elapsedMonths'));
  const result = calculateRefinance({
    balance, termMonths, legacyRate, elapsedDays, waiverRate: waiver ? 10 : 0,
    oldRate: number('oldRate'), newRate: number('newRate'), feeRate: number('feeRate'),
    availableWaiver: waiver ? optionalNumber('availableWaiver') : undefined,
    bondCost: number('bondCost'), otherCost: number('otherCost')
  });

  byId('balance-hint').textContent = won(balance);
  const years = Math.floor(termMonths / 12);
  const months = termMonths % 12;
  byId('term-hint').textContent = [years ? `${years}년` : '', months ? `${months}개월` : ''].filter(Boolean).join(' ');
  byId('days-hint').textContent = `계산에 적용한 경과일 ${decimals.format(elapsedDays)}일 · 부과 기준 ${integers.format(FEE_WINDOW_DAYS)}일. 실제 경과일을 입력하면 개월 환산값보다 우선합니다.`;
  byId('legacy-label').textContent = `개편 전 ${legacyRate.toFixed(2)}% 수수료 예시`;
  byId('three-year-label').textContent = termMonths < 36
    ? '3년 누적 순절감액 (만기까지)'
    : '3년 누적 순절감액';
  byId('actualBreakEven').textContent = recoveryLabel(result.breakEvenMonth);
  const estimate = result.estimatedBreakEven === null
    ? '첫 달 이자 기준 단순 회수: 산출 불가'
    : `첫 달 이자 기준 단순 회수: 약 ${result.estimatedBreakEven.toLocaleString('ko-KR', { maximumSignificantDigits: 6 })}개월`;
  byId('recovery-note').textContent = `${estimate}. 누적 손익분기점은 월별 상환표를 기준으로 계산합니다.`;
  byId('remainingDays').textContent = `${decimals.format(result.fee.remainingDays)}일`;
  showAmount('fee', result.fee.amount);
  for (const id of [
    'upfrontCost', 'stampCost', 'reformFee', 'legacyFee', 'feeDifference', 'monthlyPaymentSavings',
    'firstMonthInterestSavings', 'oldPayment', 'newPayment', 'threeYearNet', 'maturityNet'
  ]) {
    showAmount(id, result[id]);
  }
  drawChart(result);

  byId('error').hidden = true;
  byId('results').hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
byId('apply-reform').addEventListener('click', () => {
  byId('feeRate').value = REFORM_RATE;
  update();
});
byId('apply-legacy').addEventListener('click', () => {
  byId('feeRate').value = byId('legacyRate').value;
  update();
});
update();
