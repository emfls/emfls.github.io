import { compareGain, simulateCarryback } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('tax-form');
const history = get('history');
const error = get('input-error');
const results = get('results');
const years = [2023, 2024, 2025];
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2
});

function show(id, value) {
  get(id).textContent = value;
}

function money(id, amount) {
  show(id, dollars.format(amount));
}

function updateChart(caption, section, equity) {
  show('chart-caption', caption);
  show('chart-desc', `Section 1256: ${dollars.format(section)}. Short-term equity: ${dollars.format(equity)}.`);
  const scale = Math.max(section, equity, 1);
  for (const [id, amount] of [['section', section], ['equity', equity]]) {
    get(`${id}-bar`).setAttribute('width', String(400 * amount / scale));
    money(`${id}-bar-value`, amount);
  }
}

function renderGain(result) {
  show('results-title', 'Estimated federal tax on the gain');
  show('primary-label', 'Federal tax saved with Section 1256');
  money('primary-value', result.savings);
  show('secondary-label', 'Effective tax rate drop on the gain');
  show('secondary-value', result.rateDrop === null ? 'N/A' : `${(100 * result.rateDrop).toFixed(2)} pp`);

  for (const [id, scenario, rate] of [
    ['section', result.section1256, result.sectionRate],
    ['equity', result.equity, result.equityRate]
  ]) {
    money(`${id}-regular`, scenario.regular);
    money(`${id}-niit`, scenario.niit);
    money(`${id}-total`, scenario.total);
    show(`${id}-rate`, rate === null ? 'N/A' : percent.format(rate));
  }
  money('short-term', result.shortTerm);
  money('long-term', result.longTerm);
  money('deduction', result.deduction);
  money('magi', result.magi);
  money('nii', result.nii);
  money('niit-threshold', result.niitThreshold);
  money('baseline-niit', result.baselineNiit);
  money('total-niit', result.totalNiit);
  updateChart('Federal tax attributable to the trade', result.section1256.total, result.equity.total);
  show('live-summary', `Estimated federal tax savings: ${dollars.format(result.savings)}.`);
}

function renderLoss(result) {
  show('results-title', 'Estimated loss carryback and 2026 tax benefit');
  show('primary-label', 'Estimated prior-year regular tax refund');
  money('primary-value', result.refund);
  show('secondary-label', 'Section 1256 loss carried back');
  money('secondary-value', result.carriedBack);

  const rows = result.years.map(({ year, applied, refund }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year;
    row.append(heading);
    for (const amount of [applied, refund]) {
      const cell = document.createElement('td');
      cell.textContent = dollars.format(amount);
      row.append(cell);
    }
    return row;
  });
  get('carryback-rows').replaceChildren(...rows);

  for (const [id, scenario] of [['section', result.section1256], ['equity', result.equity]]) {
    money(`${id}-loss-deduction`, scenario.deduction);
    money(`${id}-benefit`, scenario.currentBenefit);
    money(`${id}-niit-benefit`, scenario.niitBenefit);
    money(`${id}-carryforward`, scenario.carryforward);
  }
  money('loss-cap', result.lossCap);
  updateChart('Combined benefit from prior-year refund and 2026 tax reduction',
    result.refund + result.section1256.currentBenefit, result.equity.currentBenefit);
  show('live-summary', `Estimated carryback refund: ${dollars.format(result.refund)}.`);
}

function update() {
  const trade = get('trade');
  if (trade.validity.valid) {
    history.hidden = trade.valueAsNumber >= 0;
    history.disabled = history.hidden;
  }
  const invalid = form.querySelector('input:invalid');
  for (const field of form.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
  }
  results.hidden = Boolean(invalid);
  error.hidden = !invalid;
  if (invalid) {
    invalid.setAttribute('aria-invalid', 'true');
    error.textContent = `${invalid.labels[0].textContent} ${invalid.validationMessage}`;
    return;
  }

  const inputs = {
    status: get('filing-status').value,
    income: get('ordinary-income').valueAsNumber,
    otherNii: get('investment-income').valueAsNumber
  };
  const net = trade.valueAsNumber;
  const isLoss = net < 0;
  get('gain-results').hidden = isLoss;
  get('loss-results').hidden = !isLoss;
  if (isLoss) {
    const prior = years.map((year) => ({
      gain: get(`gain-${year}`).valueAsNumber,
      ordinary: get(`income-${year}`).valueAsNumber,
      eligibleLimit: get(`limit-${year}`).value ? get(`limit-${year}`).valueAsNumber : undefined
    }));
    renderLoss(simulateCarryback({ ...inputs, loss: -net, history: prior }));
  } else {
    renderGain(compareGain({ ...inputs, gain: net }));
  }
}

function loadExample(isLoss) {
  form.reset();
  if (isLoss) {
    get('trade').value = '-25000';
    const gains = [8000, 12000, 5000];
    const ordinary = [90000, 95000, 105000];
    years.forEach((year, index) => {
      get(`gain-${year}`).value = gains[index];
      get(`income-${year}`).value = ordinary[index];
    });
  }
  update();
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
get('gain-example').addEventListener('click', () => loadExample(false));
get('loss-example').addEventListener('click', () => loadExample(true));
update();
