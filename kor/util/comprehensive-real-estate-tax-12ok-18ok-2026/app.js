import { compareTax, MAX_AGE, MAX_PRICE, parseEok, parseWhole } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('tax-form');
const output = byId('calculated');
const status = byId('input-error');
const propertyInputs = ['single-property', 'first-property', 'second-property'].map(byId);
const won = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const formatWon = (amount) => won.format(amount) + '원';
const resultFields = {
  base: 'base', gross: 'gross', propertyCredit: 'property',
  personalCredit: 'credit', tax: 'tax', surtax: 'surtax', total: 'total',
};

function validate(input, value, message, errors) {
  if (value !== null) {
    input.removeAttribute('aria-invalid');
    return value;
  }
  input.setAttribute('aria-invalid', 'true');
  errors.push(message);
  return null;
}

function render() {
  const errors = [];
  const price = validate(byId('price'), parseEok(byId('price').value),
    '공시가격은 0~10,000억 원 사이의 숫자로 입력하세요.', errors);
  const age = validate(byId('age'), parseWhole(byId('age').value, MAX_AGE),
    '만 나이는 0~120 사이의 정수로 입력하세요.', errors);
  const holdingYears = validate(byId('holding'), parseWhole(byId('holding').value, age ?? MAX_AGE),
    '보유기간은 만 나이 이하의 정수로 입력하세요.', errors);

  const credits = propertyInputs.map((input) => {
    if (!input.value.trim()) {
      input.removeAttribute('aria-invalid');
      return undefined;
    }
    return validate(input, parseWhole(input.value, MAX_PRICE),
      '재산세 중복 공제액은 0~1조 원 사이의 원 단위 정수로 입력하세요.', errors);
  });

  status.textContent = [...new Set(errors)].join(' ');
  output.hidden = errors.length > 0;
  if (errors.length) return;

  const [singlePropertyCredit, ...jointPropertyCredits] = credits;
  const result = compareTax({ price, age, holdingYears, singlePropertyCredit, jointPropertyCredits });
  const { single, joint, winner, savings } = result;
  byId('result-banner').dataset.winner = winner;
  byId('winner').textContent = {
    single: '12억 공제 방식이 유리',
    joint: '부부 공동명의 인별 과세가 유리',
    tie: '두 방식의 예상 세액이 같아요',
  }[winner];
  byId('savings').textContent = winner === 'tie' ? '차이 0원' : formatWon(savings) + ' 절감';

  for (const [key, id] of Object.entries(resultFields)) {
    byId('single-' + id + '-value').textContent = formatWon(single[key]);
    byId('joint-' + id + '-value').textContent = formatWon(joint[key]);
  }
  byId('joint-individual').textContent = joint.spouses.map((spouse) => formatWon(spouse.total)).join(' / ');
  byId('credit-detail').textContent =
    '고령자 ' + result.agePercent + '% + 장기보유 ' + result.holdingPercent + '% → 적용 ' + single.creditPercent + '%';
  byId('credit-mode').textContent = credits.every((credit) => credit === undefined)
    ? '재산세 중복 공제액 자동 추정'
    : '입력한 재산세 공제액 적용 · 빈 칸은 자동 추정';

  const max = Math.max(single.total, joint.total, 1);
  byId('single-chart').setAttribute('width', single.total / max * 100 + '%');
  byId('joint-chart').setAttribute('width', joint.total / max * 100 + '%');
  byId('chart-title').textContent =
    '예상 납부액 비교. 12억 공제 방식 ' + formatWon(single.total) +
    ', 공동명의 인별 과세 합계 ' + formatWon(joint.total);
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('reset', () => queueMicrotask(render));
render();
