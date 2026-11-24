import { calculateRelocation, LOCATIONS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('relocation-form');
const results = byId('results');
const error = byId('input-error');
const ranking = byId('tax-ranking');
const routes = byId('route-results');
const money = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const numericFields = [...form.querySelectorAll('input[type="number"]')];

function setAmount(element, value) {
  element.textContent = value === null ? '—' : money.format(value === 0 ? 0 : value);
  element.classList.toggle('negative', value < 0);
}

function tableRow(label, amounts) {
  const row = document.createElement('tr');
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);
  for (const amount of amounts) {
    const cell = document.createElement('td');
    setAmount(cell, amount);
    row.append(cell);
  }
  return row;
}

function render() {
  const invalid = numericFields.find(field => !field.validity.valid);
  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = `${label} — enter a number from ${invalid.min} to ${invalid.max}.`;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const inputs = Object.fromEntries(numericFields.map(field => [field.id, field.valueAsNumber]));
  const comparison = calculateRelocation({ ...inputs, filing: byId('filing').value });
  const caToTexas = comparison.routes[0];
  setAmount(byId('gross-savings'), caToTexas.taxSavings);
  setAmount(byId('net-savings'), caToTexas.annualSavings);
  setAmount(byId('wealth-gap'), caToTexas.wealth);
  byId('property-result').textContent = caToTexas.propertyDelta === null
    ? 'Property taxes are omitted from this scenario.'
    : `Estimated annual property tax: ${money.format(comparison.caProperty)} in California and ${money.format(comparison.txProperty)} in Texas.`;

  ranking.replaceChildren(...comparison.ranking.map(bill =>
    tableRow(LOCATIONS[bill.id], [bill.income, bill.local, bill.surtax, bill.payroll, bill.total])
  ));
  routes.replaceChildren(...comparison.routes.map(route =>
    tableRow(`${LOCATIONS[route.origin]} → ${LOCATIONS[route.destination]}`,
      [route.taxSavings, route.propertyDelta, route.annualSavings, route.wealth])
  ));
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
