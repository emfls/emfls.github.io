import { calculatePension } from './model.mjs';

const form = document.querySelector('#pension-form');
const partnerRow = document.querySelector('#partner-row');
const resultPanel = document.querySelector('#pension-result');
const error = document.querySelector('#pension-error');
const fields = form.elements;
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const testLabels = {
  full: 'Full rate under both tests',
  assets: 'Assets-Test Bound',
  income: 'Income-Test Bound',
  both: 'Both tests give the same reduced rate'
};

function money(value) {
  return value > 0 && value < 0.01 ? 'Less than $0.01' : currency.format(value);
}

function update() {
  const isCouple = fields.household.value === 'couple';
  partnerRow.hidden = !isCouple;
  fields.partnerWorkIncome.disabled = !isCouple;

  const inputs = [...form.querySelectorAll('input[type="number"]:enabled')];
  const invalid = inputs.find((input) => !input.validity.valid ||
    !Number.isFinite(input.valueAsNumber) || input.valueAsNumber > Number.MAX_SAFE_INTEGER);
  if (invalid) {
    error.textContent = `Enter a valid non-negative amount for ${invalid.labels[0].textContent}.`;
    error.hidden = false;
    resultPanel.hidden = true;
    return;
  }

  const result = calculatePension({
    household: fields.household.value,
    housing: fields.housing.value,
    incomeScenario: fields.incomeScenario.value,
    ...Object.fromEntries(inputs.map((input) => [input.name, input.valueAsNumber]))
  });

  document.querySelector('#payment').textContent = money(result.payableFortnightlyPension);
  document.querySelector('#annual').textContent = `${money(result.annualPension)} annualised before tax`;
  document.querySelector('#estimate-unit').textContent = isCouple ? 'per fortnight combined' : 'per fortnight';
  document.querySelector('#limiting-test').textContent = testLabels[result.bindingTest];
  document.querySelector('#scenario-note').hidden = fields.incomeScenario.value === 'official';
  document.querySelector('#card-status').textContent = result.pensionerConcessionCard
    ? 'Expected if you qualify for and receive Age Pension'
    : 'No Age Pension payment indicated by this estimate';
  for (const output of resultPanel.querySelectorAll('[data-money]')) {
    output.textContent = money(result[output.dataset.money]);
  }

  error.hidden = true;
  resultPanel.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
