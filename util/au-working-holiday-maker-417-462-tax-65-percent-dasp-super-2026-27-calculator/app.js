import { estimate, ndaCountries } from './model.mjs';

const form = document.querySelector('#calculator');
const fields = form.elements;
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const ndaStatus = document.querySelector('#nda-status');
const settlementLabel = document.querySelector('#settlement-label');
const outputs = results.querySelectorAll('[data-result]');
const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
});

for (const country of ndaCountries) {
  fields.country.add(new Option(country, country));
}

function render() {
  if (!form.checkValidity()) {
    results.hidden = true;
    error.textContent = 'Enter valid wages and super amounts, and between 1 and 52 weeks worked.';
    return;
  }

  const estimateResult = estimate({
    wages: fields.wages.valueAsNumber,
    weeks: fields.weeks.valueAsNumber,
    existingSuper: fields.existingSuper.value === '' ? 0 : fields.existingSuper.valueAsNumber,
    payroll: fields.payroll.value,
    country: fields.country.value,
    fullYearResident: fields.fullYearResident.checked,
  });

  ndaStatus.textContent = estimateResult.ndaEligible
    ? 'Full-year resident comparison applied.'
    : 'Select an eligible nationality and confirm full-year tax residency to apply this comparison.';
  settlementLabel.textContent = Math.round(estimateResult.settlement * 100) < 0
    ? 'Estimated amount owing before offsets and levies'
    : 'Estimated refund before offsets and levies';
  for (const output of outputs) {
    const value = estimateResult[output.dataset.result];
    output.textContent = output.dataset.result === 'settlement' ? aud.format(Math.abs(value)) : aud.format(value);
  }
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
