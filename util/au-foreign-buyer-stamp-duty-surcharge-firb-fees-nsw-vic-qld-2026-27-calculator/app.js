import { compareCosts } from './model.mjs';

const inputs = document.querySelector('#calculator');
const price = document.querySelector('#purchase-price');
const marketValue = document.querySelector('#market-value');
const established = document.querySelector('#established');
const exception = document.querySelector('#exception');
const status = document.querySelector('#status');
const comparison = document.querySelector('#comparison');
const results = comparison.querySelector('tbody');
const currency = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });

function render() {
  exception.hidden = !established.checked;
  const market = marketValue.validity.badInput || marketValue.value !== '' ? marketValue.valueAsNumber : undefined;
  let costs;
  try {
    costs = compareCosts({ price: price.valueAsNumber, marketValue: market, established: established.checked });
  } catch (error) {
    results.replaceChildren();
    comparison.hidden = true;
    status.textContent = error.message;
    return;
  }

  const rows = costs.map(cost => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = cost.state;
    row.append(heading);
    const values = [
      currency.format(cost.standardDuty),
      `${currency.format(cost.surcharge)} (${cost.surchargeRate}%)`,
      currency.format(cost.firbFee),
      currency.format(cost.total),
      `${percent.format(cost.burdenPercent)}%`,
      currency.format(cost.extraCost),
      currency.format(cost.acquisitionCost),
    ];
    for (const value of values) row.insertCell().textContent = value;
    return row;
  });

  results.replaceChildren(...rows);
  comparison.hidden = false;
  status.textContent = `Dutiable value A$${currency.format(costs[0].dutiableValue)}. Federal application fee A$${currency.format(costs[0].firbFee)}.`;
}

inputs.addEventListener('input', render);
inputs.addEventListener('submit', event => event.preventDefault());
render();
