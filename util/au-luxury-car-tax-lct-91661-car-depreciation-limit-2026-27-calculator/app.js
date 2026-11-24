import { calculateVehicle } from './model.mjs';

const form = document.getElementById('calculator');
const vehicle = document.getElementById('vehicle');
const price = document.getElementById('price');
const business = document.getElementById('business');
const gst = document.getElementById('gst');
const rate = document.getElementById('rate');
const error = document.getElementById('error');
const results = document.getElementById('results');
const threshold = document.getElementById('threshold');
const comparison = document.getElementById('comparison');
const commercialNote = document.getElementById('commercial-note');
const announcement = document.getElementById('announcement');
const resultIds = [
  'lct', 'vehicleTotal', 'gstCredit', 'depreciationBase', 'businessDepreciationBase',
  'estimatedIncomeTaxSaving', 'estimatedAfterTaxCost', 'fuelEfficientLct', 'standardLct', 'lctSaving'
];
const resultFields = resultIds.map(id => document.getElementById(id));
const dollars = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol'
});

function render() {
  for (const field of [price, business]) {
    field.setAttribute('aria-invalid', String(!field.validity.valid));
  }

  let quote;
  try {
    quote = calculateVehicle({
      vehicleType: vehicle.value,
      lctValue: price.valueAsNumber,
      businessUse: business.valueAsNumber,
      gstRegistered: gst.checked,
      taxRate: Number(rate.value)
    });
  } catch (invalidInput) {
    if (!(invalidInput instanceof RangeError)) throw invalidInput;
    results.hidden = true;
    announcement.textContent = '';
    error.textContent = invalidInput.message;
    error.hidden = false;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  for (const field of resultFields) {
    const value = quote[field.id];
    field.textContent = value === null ? '' : dollars.format(value);
  }

  const commercial = quote.threshold === null;
  threshold.textContent = commercial
    ? ''
    : 'Applicable LCT threshold: ' + dollars.format(quote.threshold) + '.';
  threshold.hidden = commercial;
  comparison.hidden = commercial;
  commercialNote.hidden = !commercial;
  results.hidden = false;
  announcement.textContent = 'Estimated LCT ' + dollars.format(quote.lct) +
    '. After-tax net cost ' + dollars.format(quote.estimatedAfterTaxCost) + '.';
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('change', render);
render();
