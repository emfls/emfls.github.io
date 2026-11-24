import { compareEstates, FEDERAL_EXCLUSION } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('estate-form');
const error = byId('error');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const money = value => currency.format(value);

function describeThreshold({ combined, aboveThreshold, reductionToThreshold, reductionStrictlyBelow }) {
  if (reductionToThreshold === null && !aboveThreshold) {
    return `Your Illinois threshold total is ${money(combined)}. It is below $4 million.`;
  }
  if (reductionToThreshold === null) {
    return `Your Illinois threshold total is ${money(combined)}. Adjusted taxable gifts alone exceed $4 million, so reducing the estate value cannot reach the threshold.`;
  }
  const status = aboveThreshold ? 'above' : 'at';
  const reduction = reductionStrictlyBelow === null
    ? 'Adjusted taxable gifts alone reach $4 million, so an estate deduction cannot take the total strictly below it.'
    : `A qualifying deduction of ${money(reductionStrictlyBelow)} would bring the total to $3,999,999.99, holding adjusted taxable gifts constant.`;
  const exact = aboveThreshold
    ? ` A deduction of ${money(reductionToThreshold)} would bring it to exactly $4 million.`
    : '';
  return `Your Illinois threshold total is ${money(combined)}, ${status} $4 million.${exact} ${reduction}`;
}

function describeFederal({ combined, difference }) {
  const exclusion = money(FEDERAL_EXCLUSION);
  const comparison = difference === 0 ? 'equal to' :
    `${money(Math.abs(difference))} ${difference > 0 ? 'above' : 'below'}`;
  return `Federal comparison · ${money(combined)} including adjusted taxable gifts is ${comparison} the ${exclusion} basic exclusion, before any state death-tax deduction or federal portability.`;
}

function render() {
  try {
    if (!form.checkValidity()) {
      throw new RangeError('Enter amounts within each input’s range using at most two decimal places.');
    }
    const estimate = compareEstates({
      estate: byId('estate').valueAsNumber,
      adjustedGifts: byId('gifts').valueAsNumber,
      illinoisShare: byId('share').valueAsNumber / 100,
      washingtonPeriod: byId('period').value,
      firstSpouseAssets: byId('spouse').valueAsNumber,
    });
    for (const state of estimate.states) {
      const prefix = state.state.toLowerCase();
      byId(`${prefix}-tax`).textContent = money(state.tax);
      byId(`${prefix}-rate`).textContent = `${percent.format(state.effectiveRate)} effective`;
      byId(`${prefix}-funding`).textContent = money(state.trustFunding);
      byId(`${prefix}-with-trust`).textContent = money(state.withTrust);
      byId(`${prefix}-saved`).textContent = money(state.trustSavings);
    }
    byId('threshold-result').textContent = describeThreshold(estimate.illinois);
    byId('federal').textContent = describeFederal(estimate.federal);
    byId('estimate').hidden = false;
    byId('trust-result').hidden = false;
    error.textContent = '';
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    byId('estimate').hidden = true;
    byId('trust-result').hidden = true;
    byId('threshold-result').textContent = '';
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
