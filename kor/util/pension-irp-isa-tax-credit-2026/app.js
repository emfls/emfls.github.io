import { calculateCredit, calculateEarlyWithdrawal, compareGrowth, parseDecimal } from './model.mjs';

const element = id => document.getElementById(id);
const numberFormat = new Intl.NumberFormat('ko-KR');
const compactFormat = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const rateFormat = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });
const won = value => numberFormat.format(value) + '원';
const signedWon = value => (value > 0 ? '+' : '') + won(value);

function readNumber(id, options, optional = false) {
  const input = element(id);
  const emptyAllowed = optional && !input.value.trim();
  const value = parseDecimal(input.value, options);
  input.setAttribute('aria-invalid', String(value === null && !emptyAllowed));
  return value;
}

function money(id, limits = {}, optional = false) {
  return readNumber(id, { scale: 10_000, ...limits }, optional);
}

function show(values) {
  for (const [id, value] of Object.entries(values)) element(id).textContent = value ?? '—';
}

function setResult(id, value) {
  const output = element(id);
  output.textContent = value === null ? '—' : signedWon(value);
  output.classList.toggle('negative', value !== null && value < 0);
}

function updateCredit() {
  const incomeType = element('income-type').value;
  element('income-label').textContent = incomeType === 'salary' ? '총급여 (만 원)' : '종합소득금액 (만 원)';

  const income = money('income');
  const savings = money('savings');
  const irp = money('irp');
  const isaSavings = money('isa-savings');
  const isaIrp = money('isa-irp');
  const maturity = element('maturity').value;
  const transfer = element('transfer').value;
  const showPrior = (isaSavings > 0 || isaIrp > 0) && maturity.startsWith('2025-')
    && transfer.startsWith('2026-');
  element('prior-field').hidden = !showPrior;
  const priorExtra = showPrior ? money('prior-extra', { max: 3_000_000 }) : 0;
  const taxCapacity = money('capacity', {}, true);
  const invalidCapacity = taxCapacity === null && Boolean(element('capacity').value.trim());
  const invalid = [income, savings, irp, isaSavings, isaIrp, priorExtra].includes(null) || invalidCapacity;
  if (invalid) {
    show({
      'maximum-credit': null, 'credit-rate': null, base: null, 'isa-limit': null, extra: null,
      eligible: null, 'usable-credit': null, 'credit-message': '표시된 입력칸에 유효한 금액을 입력하세요. 납입액이 없으면 0을 입력하세요.'
    });
    return;
  }

  const result = calculateCredit({
    incomeType, income, savings, irp, isaSavings, isaIrp, maturity, transfer, priorExtra, taxCapacity
  });
  const transferMessages = {
    none: 'ISA 전환 없이 계산했습니다.',
    eligible: `만기 후 ${result.days}일째 전환으로 2026년 공제에 반영했습니다.`,
    'missing-date': '만기일과 입금일을 모두 입력하면 ISA 전환액을 계산합니다. 현재 기본 납입액만 반영했습니다.',
    'outside-window': '입금일이 만기일 전이거나 만기일부터 60일을 지났습니다. ISA 전환액을 제외했습니다.',
    'other-year': 'ISA 전환액은 실제 입금한 해에 귀속됩니다. 2026년 공제에서는 제외했습니다.'
  };
  show({
    'maximum-credit': won(result.maximumCredit), 'credit-rate': rateFormat.format(result.rate),
    base: won(result.base), 'isa-limit': won(result.isaLimit), extra: won(result.extra), eligible: won(result.eligible),
    'usable-credit': result.usableCredit === null ? '남은 세액 입력 시 표시' : won(result.usableCredit),
    'credit-message': transferMessages[result.isaStatus]
  });
}

function updateEarlyWithdrawal() {
  const creditedPrincipal = money('credited');
  const uncreditedPrincipal = money('uncredited');
  const gain = money('gain', { min: -2_000_000_000_000 });
  const creditReceived = money('received');
  const invalid = [creditedPrincipal, uncreditedPrincipal, gain, creditReceived].includes(null);
  const result = invalid ? null : calculateEarlyWithdrawal({
    creditedPrincipal, uncreditedPrincipal, gain, creditReceived
  });
  if (!result) {
    if (!invalid) element('gain').setAttribute('aria-invalid', 'true');
    setResult('net-profit', null);
    show({
      'withdrawal-base': null, 'withdrawal-tax': null, 'withdrawal-cash': null, 'tax-difference': null,
      'withdrawal-message': invalid ? '표시된 입력칸의 금액을 확인하세요.' : '운용손실은 전체 납입원금을 초과할 수 없습니다.'
    });
    return;
  }

  const loss = result.taxDifference < 0;
  setResult('net-profit', result.netProfit);
  show({
    'withdrawal-base': won(result.taxBase), 'withdrawal-tax': won(result.tax),
    'withdrawal-cash': won(result.cash), 'tax-difference': signedWon(result.taxDifference),
    'withdrawal-message': loss
      ? `해지 세금이 받은 세액공제보다 ${won(-result.taxDifference)} 더 큽니다.`
      : '전체 해지 손익에 납입 후 운용손익과 이미 받은 세액공제를 반영했습니다.'
  });
  element('tax-difference').classList.toggle('negative', loss);
}

function drawChart(points) {
  const peak = Math.max(1, ...points.flatMap(({ pension, general }) => [pension, general]));
  const step = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.ceil(peak / step) * step;
  for (const [id, series] of [['pension-line', 'pension'], ['general-line', 'general']]) {
    const coordinates = points.map(point => {
      const x = 104 + 354 * point.year / 20;
      const y = 188 - 164 * point[series] / ceiling;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    element(id).setAttribute('points', coordinates.join(' '));
  }
  show({
    'chart-max': compactFormat.format(ceiling) + '원',
    'chart-mid': compactFormat.format(ceiling / 2) + '원'
  });
}

function updateGrowth() {
  const principal = money('principal', { max: 1_000_000_000 });
  const rate = readNumber('annual-rate', { scale: 100, min: -10_000, max: 10_000 });
  const age = Number(element('age').value);
  const invalid = principal === null || rate === null;
  element('growth-chart').hidden = invalid;
  if (invalid) {
    setResult('growth-difference', null);
    show({
      'pension-end': null, 'general-end': null,
      'growth-message': '원금은 0~10억 원, 연 수익률은 -100~100% 범위에서 입력하세요.'
    });
    return;
  }

  const points = compareGrowth({ principal, annualRate: rate / 10_000, age });
  const end = points.at(-1);
  setResult('growth-difference', end.pension - end.general);
  show({
    'pension-end': won(end.pension), 'general-end': won(end.general), 'growth-message': '',
    'chart-desc': `20년 후 연금계좌 세후 환산액은 ${won(end.pension)}, 일반계좌 세후 잔액은 ${won(end.general)}입니다.`
  });
  drawChart(points);
}

for (const [id, update] of [
  ['credit-form', updateCredit], ['early-form', updateEarlyWithdrawal], ['growth-form', updateGrowth]
]) {
  const form = element(id);
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
  update();
}

for (const button of document.querySelectorAll('[data-toggle-sign]')) {
  button.addEventListener('click', () => {
    const input = element(button.dataset.toggleSign);
    const current = input.value.trim();
    input.value = /^[-−]/.test(current) ? current.slice(1) : '-' + current;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
