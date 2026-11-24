import { calculate, cppBaseAmount, HORIZON } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const summary = document.querySelector('#results-summary');
const error = document.querySelector('#input-error');
const scenarioResults = document.querySelector('#scenario-results');
const comparisonResults = document.querySelector('#crossovers');
const recoveryWarning = document.querySelector('#recovery-warning');
const recoveryMessage = document.querySelector('#recovery-message');
const scenarioNames = ['CPP 60 / OAS 65', 'CPP 65 / OAS 65', 'CPP 70 / OAS 70', 'Custom start ages'];
const comparisonNames = {
  'cpp60-65': 'CPP 60 vs 65',
  'cpp65-70': 'CPP 65 vs 70',
  'cpp60-70': 'CPP 60 vs 70',
  'oas65-70': 'OAS 65 vs 70',
  'combined60-65': 'CPP 60 / OAS 65 vs both 65',
  'combined65-70': 'Both 65 vs both 70',
  'combined60-70': 'CPP 60 / OAS 65 vs both 70',
  'custom-65': 'Custom vs both 65'
};
const currencyOptions = { style: 'currency', currency: 'CAD' };
const monthlyMoney = new Intl.NumberFormat('en-CA', currencyOptions);
const totalMoney = new Intl.NumberFormat('en-CA', { ...currencyOptions, maximumFractionDigits: 0 });
const ageNumber = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 });

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function ageInMonths(month) {
  const years = Math.floor(month / 12);
  const months = month % 12;
  return months === 0 ? String(years) : `${years}y ${months}m`;
}

function renderScenario(scenario, index) {
  const card = element('article', undefined, 'scenario');
  const amounts = element('dl');
  const rows = [
    ['CPP at start / month', monthlyMoney.format(scenario.cppAtStart)],
    ['OAS at start / month', monthlyMoney.format(scenario.oasAtStart)],
    ['OAS after age-75 increase / month', monthlyMoney.format(scenario.oasAt75)],
    ['Gross nominal total', totalMoney.format(scenario.nominal)],
    ['Gross present value', totalMoney.format(scenario.presentValue)],
    ['Estimated lifetime OAS recovery', totalMoney.format(scenario.recoveryNominal)],
    ['Nominal after OAS recovery', totalMoney.format(scenario.netNominal)],
    ['Present value after OAS recovery', totalMoney.format(scenario.netPresentValue)]
  ];
  for (const [label, value] of rows) amounts.append(element('dt', label), element('dd', value));
  card.append(element('h3', scenarioNames[index]));
  if (index === 3) {
    card.append(element('p', `CPP at ${ageInMonths(scenario.cppStart)} · OAS at ${ageInMonths(scenario.oasStart)}`, 'note'));
  }
  card.append(amounts);
  return card;
}

function renderComparison({ id, nominal, presentValue, identical }) {
  const format = value => {
    if (identical) return 'Equal';
    return value === null ? `None by ${HORIZON}` : ageNumber.format(value);
  };
  const row = element('tr');
  const label = element('th', comparisonNames[id]);
  label.scope = 'row';
  row.append(label, element('td', format(nominal)), element('td', format(presentValue)));
  return row;
}

function render({ targetAge, scenarios, crossovers }) {
  const values = scenarios.map(scenario => Math.round(scenario.netPresentValue));
  const highest = Math.max(...values);
  const leaders = scenarioNames.filter((_, index) => values[index] === highest);
  const leaderText = leaders.length === scenarios.length ? 'All four scenarios tie' : leaders.join(' and ');
  summary.textContent = `Through age ${ageInMonths(Math.round(targetAge * 12))}. Highest present value after estimated OAS recovery is ${totalMoney.format(highest)} CAD. ${leaderText}.`;
  scenarioResults.replaceChildren(...scenarios.map(renderScenario));
  comparisonResults.replaceChildren(...crossovers.map(renderComparison));

  const exposed = scenarios.flatMap((scenario, index) => scenario.firstRecoveryAge === null
    ? [] : [`${scenarioNames[index]} (age-${scenario.firstRecoveryAge} year)`]);
  const exceedsThreshold = scenarios.some(scenario => scenario.firstThresholdAge !== null);
  recoveryWarning.hidden = !exceedsThreshold;
  recoveryMessage.textContent = exposed.length
    ? `Projected annual income exceeds the $95,323 threshold and reduces OAS in ${exposed.join(', ')}. Each card shows the estimated lifetime recovery.`
    : 'Projected annual income exceeds the $95,323 threshold. There are no OAS payments to recover in the affected years through your target age.';
  results.hidden = false;
}

function update() {
  const fields = form.elements;
  const isPercent = fields.cppBasis.value === 'percent';
  document.querySelector('#percentField').hidden = !isPercent;
  document.querySelector('#amountField').hidden = isPercent;
  fields.cppPercent.disabled = !isPercent;
  fields.cppEstimate.disabled = isPercent;

  const enabledInputs = [...form.querySelectorAll('input:not(:disabled)')];
  const invalid = enabledInputs.filter(input => !input.validity.valid);
  for (const input of form.querySelectorAll('input')) {
    if (invalid.includes(input)) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  if (invalid.length > 0) {
    const field = invalid[0];
    error.textContent = `${field.labels[0].textContent}. ${field.validationMessage}`;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  try {
    const read = name => fields[name].valueAsNumber;
    const cppBase = cppBaseAmount(fields.cppBasis.value, read(isPercent ? 'cppPercent' : 'cppEstimate'));
    render(calculate({
      cppBase,
      yearsInCanada: read('yearsInCanada'),
      cppAge: read('cppAge'),
      oasAge: read('oasAge'),
      lifeAge: read('lifeAge'),
      inflation: read('inflation') / 100,
      realDiscount: read('realDiscount') / 100,
      otherIncome: read('otherIncome')
    }));
    error.hidden = true;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
