import { calculatePlan, CULTURE_SALARY_LIMIT, toWon } from './model.mjs';

const form = document.querySelector('#tax-form');
const fields = form.elements;
const amountFields = ['salary', 'credit', 'debit', 'market', 'transit', 'culture', 'budget'];
const scenarioKeys = ['debit', 'market', 'gym'];
const wonFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const ratioFormat = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });
const won = (value) => `${wonFormat.format(value)}원`;
const byId = (id) => document.getElementById(id);

const outputs = [
  'total-savings', 'spending-total', 'threshold', 'remaining', 'excess',
  'base-deduction', 'extra-deduction', 'card-deduction', 'card-savings',
  'marriage-credit', 'child-credit', 'family-credit', 'max-additional',
  'projected-savings', 'general-split', ...scenarioKeys.map((key) => `${key}-saving`),
];

function render() {
  const salary = toWon(fields.salary.value);
  const aboveCultureLimit = salary > CULTURE_SALARY_LIMIT;
  fields.culture.disabled = aboveCultureLimit;
  fields.gymShare.disabled = aboveCultureLimit;
  fields.spouse.disabled = !fields.married.checked;
  if (fields.spouse.disabled) fields.spouse.checked = false;

  const cultureEntered = toWon(fields.culture.value);
  byId('culture-note').textContent = aboveCultureLimit
    ? `총급여 7,000만 원 초과로 문화체육비 칸의 ${won(cultureEntered)}은 합계에서 제외됩니다. 공제 대상 사용액은 실제 결제수단 칸에 옮겨 입력하세요.`
    : '전통시장·대중교통·문화체육비는 각 항목에 한 번만 입력하세요. 문화체육비에는 등록 사업자의 시설 이용료 등 인정액만 넣으세요.';
  byId('gym-label').textContent = aboveCultureLimit ? '헬스장·수영장 (일반 체크)' : '헬스장·수영장';
  byId('total-label').textContent = fields.spouse.checked
    ? '현재 사용 기준 총 예상 절세액 (배우자 혼인 공제 포함)'
    : '현재 사용 기준 총 예상 절세액';

  const invalid = [...fields].some((field) => field.willValidate && !field.validity.valid);
  byId('input-error').hidden = !invalid;
  if (invalid) {
    for (const id of outputs) byId(id).textContent = '—';
    for (const key of scenarioKeys) byId(`${key}-bar`).setAttribute('width', '0');
    return;
  }

  const amounts = Object.fromEntries(amountFields.map((key) => [key, toWon(fields[key].value)]));
  const result = calculatePlan({
    ...amounts,
    rate: Number(fields.rate.value),
    gymShare: Number(fields.gymShare.value),
    limitChildren: Number(fields.limitChildren.value),
    creditChildren: Number(fields.creditChildren.value),
    marriagePeople: Number(fields.married.checked) + Number(fields.spouse.checked),
  });

  const { card, family, generalSplit, scenarios, maxAdditional } = result;
  const displayed = {
    'total-savings': result.totalSavings,
    'spending-total': card.total,
    threshold: card.threshold,
    remaining: card.remaining,
    excess: card.excess,
    'card-deduction': card.deduction,
    'card-savings': result.cardSavings,
    'marriage-credit': family.marriage,
    'child-credit': family.children,
    'family-credit': family.total,
    'max-additional': maxAdditional,
    'projected-savings': result.projectedSavings,
  };

  for (const [id, value] of Object.entries(displayed)) byId(id).textContent = won(value);
  byId('base-deduction').textContent = `${won(card.baseDeduction)} / ${won(card.baseLimit)}`;
  byId('extra-deduction').textContent = `${won(card.additionalDeduction)} / ${won(card.additionalLimit)}`;
  byId('general-split').textContent = amounts.budget > 0
    ? `신용 ${won(generalSplit.credit)} (${ratioFormat.format(generalSplit.credit / amounts.budget)}) · 체크 ${won(generalSplit.debit)} (${ratioFormat.format(generalSplit.debit / amounts.budget)})`
    : '예정 지출을 입력하면 신용카드와 체크카드의 배분을 볼 수 있습니다.';

  for (const key of scenarioKeys) {
    byId(`${key}-saving`).textContent = won(scenarios[key]);
    const width = maxAdditional > 0 ? (scenarios[key] / maxAdditional) * 100 : 0;
    byId(`${key}-bar`).setAttribute('width', String(width));
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
