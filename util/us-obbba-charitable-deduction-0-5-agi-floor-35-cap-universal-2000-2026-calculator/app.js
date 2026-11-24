import { compareGiving } from './model.mjs';

const form = document.querySelector('#giving-form');
const results = document.querySelector('#giving-results');
const error = document.querySelector('#giving-error');
const spouseField = document.querySelector('#spouse-field');
const fields = form.elements;
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent' });
const money = amount => dollars.format(Math.abs(amount) < 0.005 ? 0 : amount);

function render() {
  const filingStatus = fields.namedItem('filingStatus').value;
  spouseField.hidden = filingStatus !== 'mfs';
  let result;
  try {
    result = compareGiving({
      filingStatus,
      spouseItemizes: fields.namedItem('spouseItemizes').checked,
      agi: fields.namedItem('agi').valueAsNumber,
      directCash: fields.namedItem('directCash').valueAsNumber,
      otherCash: fields.namedItem('otherCash').valueAsNumber,
      stock: fields.namedItem('stock').valueAsNumber,
      otherDeductions: fields.namedItem('otherDeductions').valueAsNumber,
    });
  } catch (problem) {
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const { annual, bunching, taxAdvantage } = result;
  const advantage = money(Math.abs(taxAdvantage));
  const winner = {
    itemize: `Itemizing lowers estimated tax by ${advantage}.`,
    standard: `The non-itemizer path lowers estimated tax by ${advantage}.`,
    tie: 'Both paths give the same estimated federal income tax.',
  };
  const values = {
    decision: winner[result.winner],
    'standard-base': money(result.standardDeduction),
    'universal-deduction': money(annual.universalDeduction),
    'standard-allowed': money(annual.standardAllowed),
    'standard-tax': money(annual.standardTax),
    'itemized-charity': money(annual.itemizedCharitableDeduction),
    'section-68': money(annual.itemized.section68Reduction),
    'itemized-allowed': money(annual.itemized.allowed),
    'itemized-tax': money(annual.itemized.tax),
    'gift-savings': money(result.bestGiftTaxSavings),
    'agi-floor': money(result.agiFloor),
    'floor-withheld': money(annual.lostToFloor),
    'floor-potential-carry': money(annual.potentiallyCarriedFloor),
    'cap-excess': money(annual.capExcess),
    'annual-tax': money(bunching.annualTax),
    'bunched-tax': money(bunching.bunchedTax),
    'floor-recovered': money(bunching.floorRecovered),
    'floor-tax-savings': money(bunching.floorOnlyTaxSavings),
    'annual-cap-excess': money(bunching.annualCapExcess),
    'bunched-cap-excess': money(bunching.bunchedCapExcess),
    'benchmark': `${money(bunching.twoFloorBenchmark)} at ${percent.format(result.effectiveRate)}`,
    'bunching-result': Math.abs(bunching.taxSavings) < 0.005
      ? 'Both schedules have the same estimated three-year tax.'
      : `Bunching ${bunching.taxSavings > 0 ? 'lowers' : 'raises'} estimated three-year tax by ${money(Math.abs(bunching.taxSavings))}.`,
  };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).textContent = value;
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
