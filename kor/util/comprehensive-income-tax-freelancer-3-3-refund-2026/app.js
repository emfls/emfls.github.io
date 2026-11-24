import { calculate, toWon } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('tax-form');
const scenario = get('scenario');
const number = new Intl.NumberFormat('ko-KR');
const won = (value) => `${number.format(value)}원`;
const moneyFields = ['revenue', 'bookExpenses', 'majorExpenses', 'nationalPension', 'yellowUmbrella', 'pensionSavings', 'irp'];
const methods = { simple: '단순경비율', basis: '기준경비율', book: '장부 신고' };
const chartKeys = [...Object.keys(methods), 'withheld'];
const detailFields = {
  'business-income': 'businessIncome',
  'personal-deduction': 'personalDeduction',
  'national-pension': 'nationalPension',
  'umbrella-deduction': 'umbrellaDeduction',
  'taxable-income': 'taxableIncome',
  'gross-tax': 'grossTax',
  'standard-credit': 'standardCredit',
  'pension-credit': 'pensionCredit',
  'book-credit': 'bookCredit',
  'applied-credits': 'appliedCredits',
  'national-tax': 'national',
  'local-tax': 'local'
};

function presentation(balance) {
  if (balance < 0) return { tone: 'refund', label: '예상 환급액', amount: `+${won(-balance)}` };
  if (balance > 0) return { tone: 'due', label: '예상 추가납부액', amount: `−${won(balance)}` };
  return { tone: 'even', label: '예상 정산 차액', amount: won(0) };
}

function render() {
  const invalid = form.querySelector('input:invalid');
  get('calculation-error').hidden = !invalid;
  if (invalid) {
    get('calculation-error').textContent = `${invalid.labels[0].textContent} 입력 범위를 확인하세요. 수정하면 결과를 다시 계산합니다.`;
  }
  get('result-values').hidden = Boolean(invalid);
  get('comparison-values').hidden = Boolean(invalid);
  if (invalid) return;

  const input = Object.fromEntries(moneyFields.map((id) => [id, toWon(get(id).value)]));
  const result = calculate({
    ...input,
    simpleRate: get('simpleRate').value,
    basisRate: get('basisRate').value,
    people: get('people').value,
    standardCredit: get('standardCredit').checked,
    doubleEntry: get('doubleEntry').checked,
    requiredDoubleEntry: get('requiredDoubleEntry').checked
  });

  const method = scenario.value;
  const current = result[method];
  const { tone, label, amount } = presentation(current.balance);
  get('result-card').dataset.tone = tone;
  get('balance-label').textContent = `5월 ${label}`;
  get('balance').textContent = amount;
  get('result-note').textContent = `${methods[method]} · 결정세액 ${won(current.total)} − 기납부세액 ${won(result.withheld.total)}`;

  for (const [id, key] of Object.entries(detailFields)) get(id).textContent = won(current[key]);
  for (const key of ['national', 'local', 'total']) get(`withheld-${key}`).textContent = won(result.withheld[key]);
  get('pension-rate').textContent = `(국세 ${current.pensionRate}%)`;

  for (const key of Object.keys(methods)) {
    const view = presentation(result[key].balance);
    const output = get(`${key}-balance`);
    output.dataset.tone = view.tone;
    output.textContent = `${view.label} ${view.amount}`;
  }

  const scale = Math.max(1, ...chartKeys.map((key) => result[key].total));
  for (const key of chartKeys) {
    get(`${key}-chart`).textContent = won(result[key].total);
    get(`${key}-bar`).setAttribute('width', 200 * result[key].total / scale);
  }

  const bookSavings = result.simple.total - result.book.total;
  const comparison = bookSavings === 0
    ? '장부 신고와 단순경비율의 예상 결정세액이 같습니다.'
    : `장부 신고의 예상 결정세액이 단순경비율보다 ${won(Math.abs(bookSavings))} ${bookSavings > 0 ? '적습니다' : '많습니다'}.`;
  get('comparison-note').textContent = `${comparison} 그래프는 국세와 지방소득세를 합한 금액입니다.`;
}

get('industry').addEventListener('change', (event) => {
  get('simpleRate').value = event.currentTarget.value;
  render();
});
get('requiredDoubleEntry').addEventListener('change', () => {
  const bookCredit = get('doubleEntry');
  bookCredit.disabled = get('requiredDoubleEntry').checked;
  if (bookCredit.disabled) bookCredit.checked = false;
  render();
});
form.addEventListener('input', (event) => {
  if (event.target.id !== 'industry' && event.target.id !== 'requiredDoubleEntry') render();
});
form.addEventListener('submit', (event) => event.preventDefault());
scenario.addEventListener('change', render);
render();
