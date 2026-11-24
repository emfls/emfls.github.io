import { calculate, DUE_DATES, MAX_AMOUNT } from './model.mjs';

const get = id => document.getElementById(id);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const form = get('calculator');
const results = get('results');
const error = get('input-error');
const status = get('status');
const priorTreatment = get('prior-treatment');
const extra = get('extra');
const tryRescue = get('try-rescue');
const scenarioResult = get('scenario-result');

const number = id => get(id).valueAsNumber;
const showMoney = (id, value) => { get(id).textContent = money.format(value); };

function readInputs() {
  const priorAvailable = priorTreatment.value === 'eligible';
  get('prior-agi').disabled = !priorAvailable;
  get('prior-tax').disabled = !priorAvailable;
  return {
    filingStatus: get('filing-status').value,
    priorYearTreatment: priorTreatment.value,
    priorYearAgi: priorAvailable ? number('prior-agi') : 0,
    priorYearTax: priorAvailable ? number('prior-tax') : 0,
    currentYearTax: number('current-tax'),
    withholding: number('withholding'),
    estimatedPayments: DUE_DATES.map((_, index) => {
      const quarter = index + 1;
      const amount = number(`q${quarter}`);
      return { amount, date: amount === 0 ? undefined : get(`date${quarter}`).value };
    }),
  };
}

function renderQuarters(quarters) {
  const rows = quarters.map((quarter, index) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = `Q${index + 1}`;
    row.append(heading);
    for (const value of [
      date.format(new Date(quarter.dueDate)),
      money.format(quarter.newUnderpayment),
      money.format(quarter.balanceDue),
      money.format(quarter.penalty),
    ]) {
      row.insertCell().textContent = value;
    }
    return row;
  });
  get('quarter-rows').replaceChildren(...rows);
}

function renderBaseline(baseline) {
  showMoney('total-penalty', baseline.totalPenalty);
  showMoney('annual-target', baseline.requiredAnnualPayment);
  showMoney('quarterly-target', baseline.requiredQuarterlyInstallment);
  showMoney('withholding-share', baseline.withholdingPerInstallment);
  showMoney('rescue', baseline.additionalWithholding);
  status.dataset.status = baseline.status;
  if (baseline.exemption === 'DE_MINIMIS') {
    status.textContent = 'No penalty. Tax after withholding is under $1,000.';
  } else if (baseline.exemption === 'NO_PRIOR_LIABILITY') {
    status.textContent = 'No penalty. The qualifying zero prior-year liability exception applies.';
  } else if (baseline.status === 'SAFE_HARBOR_MET') {
    status.textContent = 'Safe harbor met on every installment deadline.';
  } else if (baseline.totalPenalty === 0) {
    status.textContent = 'An installment was late. The estimated penalty rounds to $0.00.';
  } else {
    status.textContent = 'At least one installment was underpaid on its due date.';
  }

  const currentTarget = `90% of 2026 tax is ${money.format(baseline.currentYearTarget)}.`;
  const priorTarget = baseline.priorYearTarget === null
    ? ' The 2025 tax target is excluded.'
    : ` ${Math.round(baseline.priorYearMultiplier * 100)}% of 2025 tax is ${money.format(baseline.priorYearTarget)}.`;
  get('target-detail').textContent = currentTarget + priorTarget;
  get('projection-note').hidden = !baseline.usesProjectedRate;
  tryRescue.disabled = baseline.additionalWithholding === 0;
  results.hidden = false;
  renderQuarters(baseline.quarters);
}

function renderScenario(inputs) {
  if (!extra.validity.valid) {
    extra.setAttribute('aria-invalid', 'true');
    scenarioResult.textContent = 'Enter extra withholding as a nonnegative dollar amount with up to two decimal places.';
    return;
  }

  const totalCents = Math.round(inputs.withholding * 100) + Math.round(extra.valueAsNumber * 100);
  if (totalCents > MAX_AMOUNT * 100) {
    extra.setAttribute('aria-invalid', 'true');
    scenarioResult.textContent = `Total withholding must be ${money.format(MAX_AMOUNT)} or less.`;
    return;
  }
  extra.removeAttribute('aria-invalid');
  const scenario = calculate({ ...inputs, withholding: totalCents / 100 });
  scenarioResult.textContent = `With ${money.format(scenario.withholdingPerInstallment)} credited per installment, the estimated penalty is ${money.format(scenario.totalPenalty)}.`;
}

function update(useSuggested = false) {
  const inputs = readInputs();
  let baseline;
  try {
    baseline = calculate(inputs);
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  if (useSuggested) extra.value = baseline.additionalWithholding;
  renderBaseline(baseline);
  renderScenario(inputs);
}

form.addEventListener('input', () => update());
form.addEventListener('submit', event => event.preventDefault());
extra.addEventListener('input', () => renderScenario(readInputs()));
tryRescue.addEventListener('click', () => update(true));
update();
