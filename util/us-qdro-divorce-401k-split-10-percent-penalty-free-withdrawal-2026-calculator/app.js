import { calculateQdro } from './model.mjs';

const form = document.querySelector('#qdro-form');
const { award, cash, rollover, age, filingStatus, otherIncome, stateTaxPct,
  stateWithholdingPct, iraWithholdingPct, annualGrowthPct } = form.elements;
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const loss = document.querySelector('#loss-example');
const resultCells = Array.from(results.querySelectorAll('[data-result]'));
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const numericFields = [award, cash, rollover, age, otherIncome, stateTaxPct,
  stateWithholdingPct, iraWithholdingPct, annualGrowthPct];
let splitSource = cash;

function updateSplit(field) {
  if (![award, cash, rollover].includes(field)) return;
  if (field !== award) splitSource = field;
  const destination = splitSource === rollover ? cash : rollover;
  if (!award.validity.valid || !splitSource.validity.valid) return;
  if (splitSource.valueAsNumber > award.valueAsNumber) {
    destination.value = '';
    return;
  }
  const remainder = Math.round(award.valueAsNumber * 100) - Math.round(splitSource.valueAsNumber * 100);
  destination.value = (remainder / 100).toFixed(2);
}

function formatSettlement(value) {
  if (value === 0) return money.format(0);
  const label = value > 0 ? 'overwithheld' : 'due';
  return `${money.format(Math.abs(value))} ${label}`;
}

function render(changedField) {
  updateSplit(changedField);
  try {
    if (award.validity.valid && splitSource.valueAsNumber > award.valueAsNumber) {
      throw new RangeError('Cash and rollover amounts each must be no greater than the award.');
    }
    const invalid = numericFields.find(field => !field.validity.valid);
    if (invalid) {
      throw new RangeError(`${invalid.labels[0].textContent} — ${invalid.validationMessage}`);
    }
    const calculation = calculateQdro({
      award: award.valueAsNumber,
      cash: cash.valueAsNumber,
      age: age.valueAsNumber,
      filingStatus: filingStatus.value,
      otherIncome: otherIncome.valueAsNumber,
      stateTaxPct: stateTaxPct.valueAsNumber,
      stateWithholdingPct: stateWithholdingPct.valueAsNumber,
      iraWithholdingPct: iraWithholdingPct.valueAsNumber,
      annualGrowthPct: annualGrowthPct.valueAsNumber,
    });

    for (const cell of resultCells) {
      const [scenario, key] = cell.dataset.result.split('.');
      const value = key ? calculation[scenario][key] : calculation[scenario];
      cell.textContent = key?.endsWith('Settlement') ? formatSettlement(value) : money.format(value);
    }
    document.querySelector('#age-horizon').textContent = calculation.yearsTo65 === 0
      ? 'at your current age (65 or older)'
      : `at age 65 (${Number(calculation.yearsTo65.toFixed(2))} years)`;
    loss.textContent = calculation.penaltySaved > 0
      ? `At the amounts entered, withdrawing from the IRA first adds ${money.format(calculation.penaltySaved)} in federal tax compared with taking the same gross cash directly under the QDRO.`
      : 'At the age and cash amount entered, the IRA scenario shows no additional early-distribution tax.';
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    loss.textContent = '';
    results.hidden = true;
  }
}

form.addEventListener('input', event => render(event.target));
form.addEventListener('submit', event => {
  event.preventDefault();
  render(document.activeElement);
});
render(award);
