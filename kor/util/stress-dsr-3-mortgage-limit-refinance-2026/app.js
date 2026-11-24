import { mortgageLimit, refinance, RATE_TYPES, STRESS_POLICIES } from './model.mjs';

const byId = id => document.getElementById(id);
const whole = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const money = value => `${decimal.format(value === 0 ? 0 : value)}만 원`;
const monthLabel = value => value === null ? '만기 내 미회수' : value === 0 ? '즉시' : `${value}개월`;

function replaceRows(id, rows, selected = -1) {
  const elements = rows.map(([heading, ...values], index) => {
    const row = document.createElement('tr');
    if (selected === index) row.dataset.selected = 'true';
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = heading;
    row.append(label);
    for (const value of values) {
      const cell = document.createElement('td');
      cell.className = 'num';
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  byId(id).replaceChildren(...elements);
}

const dsrForm = byId('dsr-form');
const dsrFields = dsrForm.elements;
let previousPolicy = dsrFields.policy.value;
let scenarioRate = '3.00';

function updatePolicy() {
  const policy = dsrFields.policy.value;
  const stress = dsrFields.stressRate;
  const isScenario = policy === 'scenario';
  if (previousPolicy === 'scenario' && stress.validity.valid) scenarioRate = stress.value;
  if (isScenario && previousPolicy !== 'scenario') stress.value = scenarioRate;
  if (!isScenario) stress.value = STRESS_POLICIES[policy].baseRate.toFixed(2);
  stress.readOnly = !isScenario;
  dsrFields.years.options[1].disabled = policy === 'metro';
  if (policy === 'metro') dsrFields.years.value = '30';

  const context = {
    regional: '기본 1.50%p에 지역 기본비율 50%와 금리 유형별 비율을 차례로 곱합니다.',
    metro: '기본 3.00%p에 금리 유형별 비율을 곱합니다. 이 기준에서는 만기가 30년으로 제한됩니다.',
    scenario: '2.25%p~3.00%p 등 원하는 가산 기준값을 입력하세요. 유형별 100·60·30·0%를 곱하는 가정입니다.',
  };
  byId('dsr-context').textContent = context[policy];
  previousPolicy = policy;
}

function renderDsr() {
  const { annualBudget, unstressed, selected, reduction, comparisons } = mortgageLimit({
    income: dsrFields.income.valueAsNumber,
    dsr: Number(dsrFields.dsr.value),
    annualDebt: dsrFields.annualDebt.valueAsNumber,
    rate: dsrFields.rate.valueAsNumber,
    years: Number(dsrFields.years.value),
    policy: dsrFields.policy.value,
    stressRate: dsrFields.stressRate.valueAsNumber,
    type: dsrFields.type.value,
  });

  byId('limit').textContent = money(selected.limit);
  byId('unstressed').textContent = money(unstressed);
  byId('reduction').textContent = money(reduction);
  byId('screening').textContent = `${percent.format(selected.screeningRate)}%`;
  byId('budget').textContent = `가용 연간 원리금 ${money(annualBudget)}`;
  replaceRows('limit-rows', comparisons.map(row => [
    RATE_TYPES[row.type], `${whole.format(row.factor * 100)}%`,
    `+${percent.format(row.addedRate)}%p`, decimal.format(row.limit),
  ]), comparisons.indexOf(selected));
}

const refinanceForm = byId('refinance-form');
const refinanceFields = refinanceForm.elements;

function renderChart(scenarios, months) {
  const [oldPlan, newPlan] = scenarios;
  // Cumulative interest savings move monotonically for equal remaining terms.
  const endpoints = [0, oldPlan.net[0], newPlan.net[0], oldPlan.maturity, newPlan.maturity];
  const min = Math.min(...endpoints);
  const max = Math.max(...endpoints);
  const range = max - min || 1;
  const y = value => 170 - ((value - min) / range) * 150;
  const zero = y(0);
  byId('chart-axis').setAttribute('d', `M72 12V178H495 M72 ${zero}H495`);
  byId('chart-zero').setAttribute('y', zero + 5);
  const path = plan => plan.net.map((value, index) => {
    const x = 72 + 423 * (index / months);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y(value).toFixed(2)}`;
  }).join(' ');
  byId('chart-old').setAttribute('d', path(oldPlan));
  byId('chart-new').setAttribute('d', path(newPlan));
  byId('chart-end').textContent = `만기 · ${whole.format(months)}개월`;
  byId('chart-desc').textContent = `대환 시 초기 비용을 차감합니다. 만기 순이자 절감액은 개편 전 ${money(oldPlan.maturity)}, 개편 후 ${money(newPlan.maturity)}입니다.`;
}

function renderRefinance() {
  const months = Math.round(refinanceFields.remainingYears.valueAsNumber * 12);
  const oldFeeRate = refinanceFields.oldFeeRate.valueAsNumber;
  const newFeeRate = refinanceFields.newFeeRate.valueAsNumber;
  const result = refinance({
    principal: refinanceFields.principal.valueAsNumber,
    oldRate: refinanceFields.oldRate.valueAsNumber,
    newRate: refinanceFields.newRate.valueAsNumber,
    months,
    elapsedMonths: refinanceFields.elapsedMonths.valueAsNumber,
    oldFeeRate,
    newFeeRate,
    expenses: refinanceFields.expenses.valueAsNumber,
  });

  byId('monthly-savings').textContent = money(result.monthlySavings);
  byId('payments').textContent = `${decimal.format(result.oldPayment)} → ${decimal.format(result.newPayment)}`;
  byId('old-fee-label').textContent = `개편 전 ${percent.format(oldFeeRate)}%`;
  byId('new-fee-label').textContent = `개편 후 ${percent.format(newFeeRate)}%`;
  const horizon = result.horizon === 60 ? '5년' : `${result.horizon}개월`;
  const metrics = [
    ['중도상환수수료', 'fee', money],
    ['초기비용 합계', 'upfront', money],
    ['이자 기준 손익분기', 'breakEven', monthLabel],
    ['현금흐름 기준 손익분기', 'cashBreakEven', monthLabel],
    [`${horizon} 순이자 절감`, 'fiveYear', money],
    ['만기 순이자 절감', 'maturity', money],
  ];
  replaceRows('refinance-rows', metrics.map(([label, key, format]) =>
    [label, ...result.scenarios.map(plan => format(plan[key]))]
  ));
  renderChart(result.scenarios, months);
}

function bind(form, resultId, errorId, render, refreshControls = () => {}) {
  const result = byId(resultId);
  const error = byId(errorId);
  const inputs = [...form.querySelectorAll('input')];
  const update = () => {
    refreshControls();
    for (const field of inputs) field.setAttribute('aria-invalid', String(!field.validity.valid));
    try {
      if (inputs.some(field => !field.validity.valid)) {
        throw new RangeError('빈칸을 채우고 입력 범위를 확인해 주세요.');
      }
      render();
      error.hidden = true;
      result.hidden = false;
    } catch (exception) {
      if (!(exception instanceof RangeError)) throw exception;
      error.textContent = exception.message;
      error.hidden = false;
      result.hidden = true;
    }
    if (form === refinanceForm) byId('chart').hidden = result.hidden;
  };
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', update);
  update();
}

bind(dsrForm, 'dsr-result', 'dsr-error', renderDsr, updatePolicy);
bind(refinanceForm, 'refinance-result', 'refinance-error', renderRefinance);
