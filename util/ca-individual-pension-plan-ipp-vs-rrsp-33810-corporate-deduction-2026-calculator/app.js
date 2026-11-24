import { estimate, maxEligiblePastYears } from './model.mjs';

const form = document.querySelector('#ipp-calculator');
const fields = [...form.querySelectorAll('input[type="number"]')];
const error = document.querySelector('#validation');
const results = document.querySelector('#results');
const projection = document.querySelector('#projection');
const rows = projection.querySelector('tbody');
const breakEven = document.querySelector('#break-even');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

function calculate() {
  const values = Object.fromEntries(fields.map(field => [field.id, field.valueAsNumber]));
  try {
    const maximum = maxEligiblePastYears(values.firstServiceYear);
    form.querySelector('#pastYears').max = maximum;
    document.querySelector('#past-maximum').textContent = `Up to ${maximum} years before 2026. Count only eligible T4 employment.`;
    const result = estimate(values);

    for (const target of results.querySelectorAll('[data-amount]')) {
      target.textContent = currency.format(result[target.dataset.amount]);
    }
    breakEven.textContent = result.breakEvenYear === null ? 'No break-even in 10 years' : `Year ${result.breakEvenYear}`;

    const fragment = document.createDocumentFragment();
    for (const row of result.years) {
      const tr = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = `${row.year} · ${row.age}`;
      tr.append(heading);
      for (const amount of [row.ipp, row.rrsp, row.pastFunding, row.topUp, row.afterTaxFees, row.cumulativeAdvantage]) {
        const cell = document.createElement('td');
        cell.textContent = currency.format(amount);
        tr.append(cell);
      }
      fragment.append(tr);
    }
    rows.replaceChildren(fragment);
    error.textContent = '';
    error.hidden = true;
    results.hidden = false;
    projection.hidden = false;
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    error.hidden = false;
    results.hidden = true;
    projection.hidden = true;
  }
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});
calculate();
