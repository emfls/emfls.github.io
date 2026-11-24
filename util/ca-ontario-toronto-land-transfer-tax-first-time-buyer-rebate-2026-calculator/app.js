import { calculateLandTransferTax } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('tax-form');
const price = byId('price');
const location = byId('location');
const period = byId('period');
const share = byId('share');
const nrst = byId('nrst');
const mnrst = byId('mnrst');
const error = byId('input-error');
const estimate = byId('estimate');
const comparison = byId('comparison');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyOutputs = [
  ['total', 'totalDue'],
  ['ontario-ltt', 'ontarioLtt'],
  ['toronto-mltt', 'torontoMltt'],
  ['ontario-rebate', 'ontarioRebate'],
  ['toronto-rebate', 'torontoRebate'],
  ['combined-rebates', 'combinedRebates'],
  ['ontario-nrst', 'ontarioNrst'],
  ['toronto-mnrst', 'torontoMnrst'],
  ['gross', 'totalBeforeRebates'],
  ['inside-total', 'torontoDue'],
  ['outside-total', 'outsideTorontoDue'],
  ['premium', 'torontoPremium'],
].map(([id, key]) => [byId(id), key]);

function updateEstimate() {
  const invalidField = [price, share].find(field => !field.validity.valid);
  for (const field of [price, share]) {
    field.setAttribute('aria-invalid', String(!field.validity.valid));
  }
  if (invalidField) {
    error.textContent = invalidField === price
      ? 'Enter a purchase price from $0.01 to $1 billion, with up to two decimal places.'
      : 'Enter an eligible ownership share from 0% to 100%, with up to two decimal places.';
    error.hidden = false;
    estimate.hidden = true;
    comparison.hidden = true;
    return;
  }

  const result = calculateLandTransferTax({
    purchasePrice: price.valueAsNumber,
    inToronto: location.value === 'toronto',
    registrationPeriod: period.value,
    eligibleSharePercent: share.valueAsNumber,
    applyNrst: nrst.checked,
    applyMnrst: mnrst.checked,
  });
  for (const [element, key] of moneyOutputs) {
    element.textContent = money.format(result[key]);
  }
  byId('effective-rate').textContent = `${percent.format(result.effectiveRate)} of the purchase price`;
  error.hidden = true;
  estimate.hidden = false;
  comparison.hidden = false;
}

form.addEventListener('input', updateEstimate);
form.addEventListener('submit', event => {
  event.preventDefault();
  updateEstimate();
});
updateEstimate();
