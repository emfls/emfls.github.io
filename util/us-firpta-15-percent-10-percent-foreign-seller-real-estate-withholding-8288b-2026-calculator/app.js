import { calculateFirpta } from './model.mjs';

const form = document.getElementById('firpta-form');
const status = document.getElementById('calculation-status');
const results = document.getElementById('firpta-results');
const holdbackWarning = document.getElementById('holdback-warning');
const holdbackGap = document.getElementById('holdback-gap');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent' });

function render() {
  const fields = form.elements;
  let estimate;
  try {
    estimate = calculateFirpta({
      salePrice: fields.salePrice.valueAsNumber,
      qualifyingResidence: fields.buyerUse.value === 'residence',
      purchasePrice: fields.purchasePrice.valueAsNumber,
      capitalImprovements: fields.capitalImprovements.valueAsNumber,
      accumulatedDepreciation: fields.accumulatedDepreciation.valueAsNumber,
      sellingCosts: fields.sellingCosts.valueAsNumber,
      ltcgRate: Number(fields.ltcgRate.value),
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    results.hidden = true;
    holdbackWarning.hidden = true;
    status.textContent = error.message;
    return;
  }

  for (const output of results.querySelectorAll('[data-result]')) {
    const key = output.dataset.result;
    output.textContent = key === 'firptaRate' ? percent.format(estimate[key]) : money.format(estimate[key]);
  }
  holdbackGap.textContent = money.format(estimate.potentialRelease);
  holdbackWarning.hidden = estimate.potentialRelease === 0;
  status.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
render();
