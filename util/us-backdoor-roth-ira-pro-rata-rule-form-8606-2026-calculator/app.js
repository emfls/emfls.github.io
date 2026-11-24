import { calculateBackdoorRoth, contributionLimit } from './model.mjs';

const byId = (id) => document.getElementById(id);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const ratio = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 9 });

const form = byId('ira-calculator');
const ageBand = byId('age-band');
const contribution = byId('contribution');
const conversion = byId('conversion');
const results = byId('results');
const error = byId('error');
const numericInputs = [...form.querySelectorAll('input[type="number"]')];
let activeLimit = contributionLimit(ageBand.value);

const lineLabels = [
  ['6', 'Year-end IRA value'],
  ['7', 'Other distributions'],
  ['8', 'Net Roth conversion'],
  ['9', 'Pro-rata denominator'],
  ['10', 'Nontaxable ratio'],
  ['11', 'Nontaxable conversion'],
  ['12', 'Nontaxable other distributions'],
  ['13', 'Total basis used'],
  ['14', 'Basis carried forward'],
  ['15a', 'Other distributions after basis'],
  ['15b', 'Disaster distribution adjustment'],
  ['15c', 'Taxable other distributions'],
  ['16', 'Net Roth conversion'],
  ['17', 'Nontaxable conversion'],
  ['18', 'Taxable conversion'],
];

const linesBody = byId('form-lines');
const lineRows = lineLabels.map(([line, label]) => {
  const row = linesBody.insertRow();
  const header = document.createElement('th');
  header.scope = 'row';
  header.textContent = `${line} · ${label}`;
  row.append(header);
  return { line, cells: [row.insertCell(), row.insertCell()] };
});

function updateAgeLimit() {
  const limit = contributionLimit(ageBand.value);
  if (limit !== activeLimit) {
    if (contribution.valueAsNumber === activeLimit) {
      contribution.value = limit;
      if (conversion.valueAsNumber === activeLimit) conversion.value = limit;
    }
    activeLimit = limit;
  }

  contribution.max = limit;
  byId('contribution-limit').textContent = wholeDollars.format(limit);
}

function describePortion(amount, conversionAmount) {
  const dollars = money.format(amount);
  return conversionAmount > 0 ? `${dollars} (${percent.format(amount / conversionAmount)})` : dollars;
}

function writeScenario(prefix, scenario, conversionAmount) {
  byId(`${prefix}-tax`).textContent = money.format(scenario.proRataTaxBill);
  byId(`${prefix}-tax-free`).textContent = describePortion(scenario.nontaxableConversion, conversionAmount);
  byId(`${prefix}-taxable`).textContent = describePortion(scenario.taxableConversion, conversionAmount);
  byId(`${prefix}-balance`).textContent = money.format(scenario.yearEndBalance);
  byId(`${prefix}-basis`).textContent = money.format(scenario.remainingBasisCarryover);
}

function render() {
  updateAgeLimit();
  const invalid = numericInputs.filter((input) => {
    if (input.validity.valid) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
    return !input.validity.valid;
  });

  if (invalid.length) {
    const input = invalid[0];
    const label = input.labels[0].textContent;
    error.hidden = false;
    error.textContent = `${label} — ${input.validationMessage}`;
    results.hidden = true;
    return;
  }

  const conversionAmount = conversion.valueAsNumber;
  const estimate = calculateBackdoorRoth({
    ageBand: ageBand.value,
    contribution: contribution.valueAsNumber,
    priorBasis: byId('prior-basis').valueAsNumber,
    yearEndBalance: byId('year-end-balance').valueAsNumber,
    conversion: conversionAmount,
    federalRate: Number(byId('federal-rate').value),
    stateRate: byId('state-rate').valueAsNumber,
  });
  const { withoutRollover, withRollover } = estimate;
  writeScenario('without', withoutRollover, conversionAmount);
  writeScenario('with', withRollover, conversionAmount);

  for (const { line, cells } of lineRows) {
    const formatter = line === '10' ? ratio : money;
    [withoutRollover, withRollover].forEach((scenario, index) => {
      const value = scenario.lines[line];
      cells[index].textContent = value === undefined ? '—' : formatter.format(value);
    });
  }

  byId('rollover-amount').textContent = money.format(estimate.rolloverAmount);
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  byId('tax-savings').textContent = money.format(estimate.taxSavings);
}

form.addEventListener('input', render);
form.addEventListener('change', (event) => {
  if (event.target instanceof HTMLSelectElement) render();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
render();
