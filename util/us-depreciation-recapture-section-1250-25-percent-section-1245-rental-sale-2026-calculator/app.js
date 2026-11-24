import { calculate } from './model.mjs';

const form = document.querySelector('#sale-form');
const error = document.querySelector('#input-error');
const results = document.querySelector('#results');
const exchange = document.querySelector('#exchange');
const assumptions = document.querySelector('#assumptions');
const bands = document.querySelector('#ltcg-bands');
const amounts = document.querySelectorAll('[data-amount]');
const shortHoldingRows = document.querySelectorAll('[data-short]');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const format = (value) => currency.format(Math.round(value * 100) === 0 ? 0 : value);

function readInputs() {
  const inputs = {};
  for (const control of form.elements) {
    if (!control.name) continue;

    if (control.type === 'number') {
      if (control.validity.badInput || (control.required && control.value === '')) {
        throw new RangeError(`Enter a number for ${control.labels[0].textContent}.`);
      }
      inputs[control.name] = control.value === '' ? null : control.valueAsNumber;
    } else if (control.type === 'checkbox') {
      inputs[control.name] = control.checked;
    } else {
      inputs[control.name] = control.value;
    }
  }
  return inputs;
}

function update() {
  let inputs;
  let estimate;
  try {
    inputs = readInputs();
    estimate = calculate(inputs);
  } catch (issue) {
    results.hidden = true;
    exchange.hidden = true;
    error.hidden = false;
    error.textContent = issue.message;
    return;
  }

  for (const output of amounts) {
    output.textContent = format(estimate[output.dataset.amount]);
  }
  const shortHolding = inputs.yearsHeld <= 1;
  for (const row of shortHoldingRows) {
    row.hidden = !shortHolding;
  }
  bands.textContent = shortHolding
    ? 'At one year of ownership, this estimate applies ordinary rates to the sale gain.'
    : `Long-term gain by band: ${format(estimate.ltcgAtZero)} at 0%, ${format(estimate.ltcgAtFifteen)} at 15%, ${format(estimate.ltcgAtTwenty)} at 20%.`;

  const basisNote = inputs.sec1250DepreciationOverride == null
    ? `Building depreciation uses the ${estimate.life}-year straight-line estimate.`
    : 'Building depreciation uses your entered amount.';
  const allocationNote = estimate.aggregateAllocation && inputs.sec1245Depreciation > 0
    ? 'Section 1245 uses aggregate gain. Enter allocated proceeds to refine recapture.'
    : '';
  const magiNote = estimate.magiWasEstimated
    ? `NIIT uses estimated pre-sale MAGI of ${format(estimate.magi)}.`
    : `NIIT uses entered pre-sale MAGI of ${format(estimate.magi)}.`;
  assumptions.textContent = [basisNote, allocationNote, magiNote].filter(Boolean).join(' ');

  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  exchange.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
form.addEventListener('reset', () => queueMicrotask(update));
update();
