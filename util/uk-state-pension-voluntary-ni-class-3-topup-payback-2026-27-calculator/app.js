import { calculateTopUp, PARAMETERS } from './model.mjs';

const form = document.querySelector('#pension-calculator');
const result = document.querySelector('#result');
const error = document.querySelector('#error');
const scenario = document.querySelector('#scenario');
const outputs = Object.fromEntries(
  Array.from(result.querySelectorAll('output'), output => [output.id, output])
);
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percentage = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });
const years = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });

function render() {
  const fields = form.elements;
  let estimate;
  try {
    estimate = calculateTopUp({
      currentYears: fields.currentYears.valueAsNumber,
      futureYears: fields.futureYears.valueAsNumber,
      gapYears: fields.gapYears.valueAsNumber,
      missingWeeks: fields.missingWeeks.valueAsNumber,
      niClass: fields.niClass.value,
      retirementTaxRate: Number(fields.retirementTaxRate.value),
      retirementYears: fields.retirementYears.valueAsNumber
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    result.hidden = true;
    return;
  }

  const drawingYears = fields.retirementYears.valueAsNumber;
  const gaps = fields.gapYears.valueAsNumber;
  const { minimumYears, fullQualifyingYears } = PARAMETERS;
  const messages = [];

  if (gaps === 0) {
    messages.push('Select at least one gap year to estimate the cost and payback of a top-up.');
  } else if (estimate.withTopUpYears < minimumYears) {
    messages.push('The selected gaps still leave you below 10 years. This scenario spends money without unlocking any pension.');
  } else if (estimate.crossesMinimum) {
    messages.push(`The top-up crosses the 10-year minimum and unlocks ${pounds.format(estimate.grossAnnualBoost)} a year before tax in this model.`);
  } else if (estimate.baselineYears === fullQualifyingYears) {
    messages.push('Your current and expected future years already reach the model’s full pension. These gaps add no pension.');
  } else if (estimate.paybackYears > drawingYears) {
    messages.push('The top-up does not recover its cost within the selected pension-drawing period.');
  }
  if (estimate.baselineYears < fullQualifyingYears && estimate.withTopUpYears - estimate.baselineYears < gaps) {
    messages.push('Some selected years are above the 35-year cap. The estimate includes their cost.');
  }

  const amounts = {
    'years-without': estimate.baselineYears,
    'years-with': estimate.withTopUpYears,
    'pension-without': pounds.format(estimate.baselineAnnualPension),
    'pension-with': pounds.format(estimate.withTopUpAnnualPension),
    'top-up-cost': pounds.format(estimate.totalTopUpCost),
    'annual-gross-boost': pounds.format(estimate.grossAnnualBoost),
    'annual-net-boost': pounds.format(estimate.afterTaxAnnualBoost),
    'payback': estimate.paybackYears === null
      ? (gaps > 0 ? 'No payback' : 'N/A')
      : `${estimate.paybackYears.toFixed(2)} years`,
    'lifetime-gain': pounds.format(estimate.lifetimeNetGain),
    'lifetime-roi': estimate.lifetimeRoi === null ? 'N/A' : percentage.format(estimate.lifetimeRoi)
  };
  for (const [id, value] of Object.entries(amounts)) {
    if (outputs[id].value !== String(value)) outputs[id].value = value;
  }
  document.querySelector('#drawing-period').textContent = `Over ${years.format(drawingYears)} years drawing pension`;
  scenario.textContent = messages.join(' ');
  scenario.hidden = messages.length === 0;
  error.textContent = '';
  result.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
