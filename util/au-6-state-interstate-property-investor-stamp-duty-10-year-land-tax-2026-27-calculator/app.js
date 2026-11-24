import { compareProperties, jurisdictions } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('property-form');
const results = byId('results');
const propertyType = byId('property-type');
const unitField = byId('unit-field');
const unitShare = byId('unit-share');
const error = byId('input-error');
const summary = byId('result-summary');
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const percentage = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const money = value => currency.format(value).replace('$', 'A$');

function tableRow(values, header = false) {
  const row = document.createElement('tr');
  values.forEach((value, index) => {
    const cell = document.createElement(header || index === 0 ? 'th' : 'td');
    if (header) cell.scope = 'col';
    else if (index === 0) cell.scope = 'row';
    cell.textContent = value;
    row.append(cell);
  });
  return row;
}

function render() {
  const apartment = propertyType.value === 'apartment';
  unitField.hidden = !apartment;
  unitShare.disabled = !apartment;
  const invalid = form.querySelector(':invalid');
  if (invalid) {
    results.hidden = true;
    error.textContent = invalid.labels[0].textContent + '. ' + invalid.validationMessage;
    error.hidden = false;
    return;
  }

  const readNumber = id => byId(id).valueAsNumber;
  const years = readNumber('years');
  const { initialLand, rows, delta } = compareProperties({
    price: readNumber('price'),
    landRatio: readNumber('land-ratio'),
    existingLand: readNumber('existing-land'),
    entity: byId('entity').value,
    annualGrowth: readNumber('growth'),
    years,
    actUnitShare: apartment && unitShare.value ? unitShare.valueAsNumber / 100 : 1,
  });

  const lowest = rows[0];
  const highest = rows.at(-1);
  summary.textContent = delta === 0
    ? `All six estimates are tied. Starting land value: ${money(initialLand)}.`
    : `${jurisdictions[lowest.state]} has the lowest ${years}-year total, ${money(delta)} below ${jurisdictions[highest.state]}. Starting land value: ${money(initialLand)}.`;
  byId('unit-note').hidden = !apartment || Boolean(unitShare.value);
  byId('cumulative-heading').textContent = `${years}-year land tax`;
  byId('total-heading').textContent = `${years}-year total`;
  byId('rank-rows').replaceChildren(...rows.map((row, index) => tableRow([
    `${index + 1}. ${jurisdictions[row.state]}`, money(row.duty), money(row.yearOne),
    money(row.cumulative), money(row.total), percentage.format(row.percent) + '%',
  ])));
  byId('year-head').replaceChildren(tableRow(['Year', ...rows.map(({ state }) => state)], true));
  byId('year-rows').replaceChildren(...Array.from({ length: years }, (_, index) => tableRow([
    index + 1, ...rows.map(({ annual }) => money(annual[index])),
  ])));
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === propertyType) byId('land-ratio').value = propertyType.value === 'apartment' ? 25 : 55;
  render();
});
render();
