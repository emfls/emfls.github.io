import { subscriptionScore, assessLoan, specialTerms, compareRepayments } from './model.mjs';

const get = id => document.getElementById(id);
const number = id => {
  const input = get(id);
  return input.value !== '' && input.validity.valid ? input.valueAsNumber : NaN;
};
const money = id => Math.round(number(id) * 10000);
const selected = id => get(id).value;
const checked = id => get(id).checked;
const formatted = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const won = value => `${formatted.format(value)}원`;
const points = value => `${value}점`;
const percentage = value => `${value.toFixed(2)}%`;
const write = (id, value) => { get(id).textContent = value; };

function renderScore() {
  get('homeless-months').disabled = checked('no-homeless');
  get('spouse-months').disabled = checked('no-spouse-account');
  const homelessMonths = checked('no-homeless') ? null : number('homeless-months');
  const spouseMonths = checked('no-spouse-account') ? null : number('spouse-months');
  const values = { homelessMonths, spouseMonths, dependents: number('dependents'), ownMonths: number('own-months') };
  const score = Object.values(values).some(Number.isNaN) ? null : subscriptionScore(values);
  write('score-total', score ? `${score.total} / 84점` : '입력 확인');
  for (const key of ['homeless', 'family', 'own', 'account']) {
    write(`score-${key}`, score ? points(score[key]) : '—');
  }
  write('score-spouse', score ? `+${score.spouseApplied}점 적용 (상한 적용 전 ${points(score.spouse)})` : '—');
  get('score-meter').value = score?.total ?? 0;
}

const issueLabels = {
  household: '신규 구입의 무주택 세대주 요건을 확인하세요.',
  newborn: '출산·입양 또는 신생아 공급 당첨 예외 요건을 확인하세요.',
  combinedIncome: '인정 연소득이 없거나 가구 합산 소득 한도를 초과했습니다.',
  individualIncome: '맞벌이 소득 중 1억 3,000만 원을 초과한 사람이 있습니다.',
  assets: '합산 순자산이 5억 1,100만 원을 초과했습니다.',
  appraisal: '담보 평가액이 9억 원을 초과했습니다.',
  area: '주택 소재지에 적용되는 전용면적 한도를 초과했습니다.',
  principal: '희망액이 상품 상한, 매매가 또는 LTV 한도를 초과했습니다.',
  dti: '입력값으로 추정한 DTI가 60%를 초과했습니다.',
};

function renderLoan() {
  const years = Number(selected('years'));
  const region = selected('region');
  const amounts = {
    incomeA: money('income-a'), incomeB: money('income-b'), assets: money('assets'),
    price: money('price'), appraisal: money('appraisal'), principal: money('principal'),
    annualDebtInterest: money('debt-interest'),
  };
  const area = number('area');
  const standardRate = number('standard-rate');
  const useManualRate = checked('use-manual-rate');
  get('manual-rate').disabled = !useManualRate;
  const manualRate = useManualRate ? number('manual-rate') : null;
  const numericInputs = [...Object.values(amounts), area, standardRate, manualRate];
  const valid = !numericInputs.some(Number.isNaN);
  const terms = valid ? specialTerms(amounts.incomeA + amounts.incomeB, years, region, Number(selected('children'))) : null;
  const annualRate = useManualRate ? manualRate : terms?.rate ?? null;
  const assessment = valid ? assessLoan({
    ...amounts, years, region, area, annualRate,
    firstHome: checked('first-home'), newborn: checked('newborn'), eligibleHousehold: checked('household'),
  }) : null;
  const issues = assessment?.issues ?? [];
  write('loan-status', !assessment ? '입력값과 단위를 확인하세요.' :
    issues.length ? '입력 조건 중 기준을 벗어난 항목이 있습니다.' : '입력한 주요 기준 충족 · 수탁은행 심사 필요');
  get('loan-issues').replaceChildren(...issues.map(issue => {
    const item = document.createElement('li');
    item.textContent = issueLabels[issue];
    return item;
  }));
  write('loan-limit', assessment ? `${won(assessment.limit)} (LTV ${assessment.ltv}%)` : '—');
  write('loan-dti', assessment?.dti == null ? '—' : percentage(assessment.dti));
  write('loan-rate', terms ? `연 ${percentage(terms.rate)} · 특례 ${Math.min(years, terms.years)}년 가정` : '—');

  const comparison = valid && annualRate !== null ? compareRepayments(amounts.principal, years, annualRate, standardRate) : null;
  get('comparison').hidden = !comparison;
  write('comparison-context', !comparison ? '비교하려면 유효한 금리와 희망 대출액이 필요합니다.' :
    `희망액 ${won(amounts.principal)} · ${years}년 · 특례 ${percentage(annualRate)} / 일반 ${percentage(standardRate)}` +
    (issues.length ? ' · 자격과 별개인 가정 비교' : ''));
  if (!comparison) return;
  write('special-monthly', won(comparison.special.monthly));
  write('standard-monthly', won(comparison.standard.monthly));
  write('special-interest', won(comparison.special.interest60));
  write('standard-interest', won(comparison.standard.interest60));
  write('monthly-difference', won(Math.abs(comparison.monthlySaved)));
  write('interest-difference', won(Math.abs(comparison.interestSaved)));
  write('monthly-label', comparison.monthlySaved < 0 ? '특례 월 납입 증가액' : '특례 월 납입 절감액');
  write('interest-label', comparison.interestSaved < 0 ? '특례 첫 5년 이자 증가액' : '특례 첫 5년 이자 절감액');
  const scale = Math.max(comparison.special.monthly, comparison.standard.monthly);
  get('bar-special').setAttribute('width', 100 * comparison.special.monthly / scale);
  get('bar-standard').setAttribute('width', 100 * comparison.standard.monthly / scale);
}

for (const [id, render] of [['score-inputs', renderScore], ['loan-inputs', renderLoan]]) {
  get(id).addEventListener('input', render);
  render();
}
