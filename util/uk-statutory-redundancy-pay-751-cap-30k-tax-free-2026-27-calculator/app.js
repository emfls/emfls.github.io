import { calculateRedundancy } from './model.mjs';

const form = document.querySelector('#redundancy-form');
const error = document.querySelector('#calculator-error');
const results = document.querySelector('#results');
const serviceSummary = document.querySelector('#service-summary');
const penpRow = document.querySelector('#penp-row');
const outputFields = results.querySelectorAll('[data-result]');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const numberFields = [...form.querySelectorAll('input[type="number"]')];

function update() {
  const inputs = Object.fromEntries(new FormData(form));
  for (const field of numberFields) inputs[field.name] = field.valueAsNumber;
  inputs.incomeTaxRate = Number(inputs.incomeTaxRate);

  try {
    const result = calculateRedundancy(inputs);
    for (const field of outputFields) {
      field.textContent = money.format(result[field.dataset.result]);
    }
    const { under22, age22To40, age41Plus } = result.bandYears;
    serviceSummary.textContent = result.countedYears === 0
      ? 'Statutory redundancy requires at least two complete years of continuous service.'
      : `${result.weeks} weeks × ${money.format(result.cappedWeeklyPay)} capped weekly pay. ` +
        `Years counted: ${under22} under 22, ${age22To40} aged 22–40, ${age41Plus} aged 41+.`;
    penpRow.hidden = result.penpReclassified === 0;
    error.textContent = '';
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.textContent = issue.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
