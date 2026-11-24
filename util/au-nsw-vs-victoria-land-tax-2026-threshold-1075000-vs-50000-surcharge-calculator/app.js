import { calculateLandTax, isValidTaxValue } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('land-tax-form');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol' });
const decimal = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const percent = (value) => value === null ? 'N/A' : `${decimal.format(value)}%`;
const signedMoney = (value) => value > 0 ? `+${currency.format(value)}` : currency.format(value);

function render() {
  const foreign = byId('nsw-foreign').checked;
  const vacancy = byId('vic-vacancy').checked;
  const useNswValue = byId('same-nsw-value').checked;
  const residential = byId('nsw-residential-value');
  byId('nsw-residential-entry').hidden = useNswValue;
  residential.disabled = useNswValue;
  byId('vacancy-fields').hidden = !vacancy;
  byId('vacancy-fields').disabled = !vacancy;

  const numericInputs = [...form.querySelectorAll('input[type="number"]:enabled')];
  const invalid = numericInputs.filter((input) => !input.validity.valid || !isValidTaxValue(input.valueAsNumber));
  for (const input of numericInputs) {
    input.setAttribute('aria-invalid', String(invalid.includes(input)));
  }

  const results = byId('tax-results');
  const error = byId('input-error');
  if (invalid.length) {
    const fields = invalid.map((input) => input.labels[0].textContent).join(', ');
    error.textContent = `Enter a value from $0 to $1 billion with up to two decimals for ${fields}.`;
    results.hidden = true;
    return;
  }

  const nswValue = byId('nsw-value').valueAsNumber;
  const comparison = calculateLandTax({
    nswValue,
    nswResidentialValue: useNswValue ? nswValue : residential.valueAsNumber,
    vicValue: byId('vic-value').valueAsNumber,
    nswOwnership: byId('nsw-ownership').value,
    vicOwnership: byId('vic-ownership').value,
    nswForeign: foreign,
    vicAbsentee: byId('vic-absentee').checked,
    vicCiv: vacancy ? byId('vic-civ').valueAsNumber : 0,
    vacantYears: vacancy ? Number(byId('vacancy-years').value) : 0,
  });

  for (const [state, taxes] of Object.entries({ nsw: comparison.nsw, vic: comparison.vic })) {
    byId(`${state}-total`).textContent = currency.format(taxes.total);
    byId(`${state}-base`).textContent = currency.format(taxes.landTax);
    byId(`${state}-surcharge`).textContent = currency.format(taxes.surcharge);
    byId(`${state}-rate`).textContent = percent(taxes.effectiveRate);
  }
  byId('vrlt-total').textContent = currency.format(comparison.vic.vacancy);
  byId('annual-gap').textContent = `${signedMoney(comparison.annualDifference)} / yr`;
  byId('ten-year-gap').textContent = signedMoney(comparison.tenYearDifference);

  for (const [index, scenario] of comparison.scenarios.entries()) {
    byId(`nsw-scenario-${index}`).textContent = currency.format(scenario.nsw);
    byId(`vic-scenario-${index}`).textContent = currency.format(scenario.vic);
  }
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
