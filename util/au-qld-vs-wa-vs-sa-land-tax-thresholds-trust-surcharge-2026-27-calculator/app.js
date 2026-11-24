import { compareLandTax, MAX_TAXABLE_VALUE } from './model.mjs';

const form = document.getElementById('land-tax-form');
const valueInput = document.getElementById('land-value');
const ownerInput = document.getElementById('owner');
const results = document.getElementById('results');
const summary = document.getElementById('result-summary');
const ranking = document.getElementById('ranking-rows');
const ownership = document.getElementById('ownership-rows');
const error = document.getElementById('land-value-error');
const stateNames = { QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia' };
const ownerNames = Object.fromEntries(
  Array.from(ownerInput.options, ({ value, textContent }) => [value, textContent]),
);
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const wholeDollars = new Intl.NumberFormat('en-AU');
const money = (value) => currency.format(value);
const delta = (value) => value > 0 ? '+' + money(value) : money(value);

function tableRow(label, cells) {
  const row = document.createElement('tr');
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);
  for (const value of cells) row.insertCell().textContent = value;
  return row;
}

function render() {
  const rawValue = valueInput.value.trim();
  const numericValue = Number(rawValue.replaceAll(',', ''));
  const valid = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(rawValue) && numericValue <= MAX_TAXABLE_VALUE;
  results.hidden = !valid;
  error.hidden = valid;
  if (!valid) {
    valueInput.setAttribute('aria-invalid', 'true');
    error.textContent = `Enter a whole-dollar land value from $0 to $${wholeDollars.format(MAX_TAXABLE_VALUE)}.`;
    return;
  }
  valueInput.removeAttribute('aria-invalid');
  error.textContent = '';

  const comparison = compareLandTax(numericValue, ownerInput.value);
  const cheapest = comparison.ranking[0].total;
  const mostExpensive = comparison.ranking.at(-1).total;
  if (cheapest === mostExpensive) {
    summary.textContent = `All three states tie at ${money(cheapest)} per year.`;
  } else {
    const namesAt = (total) => comparison.ranking.filter((entry) => entry.total === total)
      .map(({ state }) => stateNames[state]).join(' and ');
    summary.textContent = `Lowest: ${namesAt(cheapest)} at ${money(cheapest)}. Highest: ${namesAt(mostExpensive)} at ${money(mostExpensive)}. The gap is ${money(comparison.annualSpread)} per year or ${money(comparison.tenYearSpread)} over 10 years.`;
  }

  ranking.replaceChildren(...comparison.ranking.map((entry) => tableRow(stateNames[entry.state], [
    entry.rank, money(entry.base), money(entry.surcharge), money(entry.total), money(entry.tenYear),
  ])));
  ownership.replaceChildren(...comparison.ownership.map((scenario) => {
    const cells = ['QLD', 'WA', 'SA'].flatMap((state) => [
      money(scenario.taxes[state].total), delta(scenario.deltas[state]),
    ]);
    const row = tableRow(ownerNames[scenario.owner], cells);
    row.classList.toggle('selected-owner', scenario.owner === ownerInput.value);
    return row;
  }));
}

valueInput.addEventListener('input', render);
ownerInput.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
