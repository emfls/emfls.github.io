import { compare } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const routeKeys = ['personal', 'extract', 'retain'];
const annualRows = document.querySelectorAll('#annual-table [data-measure]');
const routeHeaders = document.querySelectorAll('[data-route]');
const projection = document.querySelector('#projection-body');
const pound = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const pounds = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0
});
const percentage = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const spread = new Intl.NumberFormat('en-GB', {
  signDisplay: 'exceptZero', maximumFractionDigits: 4
});
const rate = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderBreakEven({ breakEven, currentSpread, route }) {
  const scenario = route === 'retain' ? 'Retaining profits' : 'Extracting dividends';
  if (breakEven.status === 'no-mortgage' || breakEven.status === 'never') {
    setText('break-even', 'No break-even');
    setText('break-even-note', breakEven.status === 'no-mortgage'
      ? 'There is no mortgage on either route.'
      : `${scenario} trails personal ownership even with a 0% SPV mortgage rate.`);
    return;
  }
  setText('break-even', `${spread.format(breakEven.spread)} pp`);
  const threshold = `${rate.format(breakEven.rate)}% SPV mortgage rate`;
  const current = `${spread.format(currentSpread)} pp entered spread`;
  setText('break-even-note', breakEven.status === 'tie-at-zero'
    ? `The routes tie at a ${threshold}. Personal ownership leads at higher rates.`
    : `Ties at a ${threshold}. The SPV leads below that rate. ${current}.`);
}

function render(result) {
  const { loanAmount, currentSpread, route, wealthAdvantage, personal } = result;
  const selected = result[route];
  setText('loan-amount', pounds.format(loanAmount));
  setText('current-spread', loanAmount === 0
    ? 'N/A without a mortgage'
    : `${spread.format(currentSpread)} percentage points`);

  const difference = Math.round(Math.abs(wealthAdvantage));
  const title = route === 'retain' ? 'SPV retain' : 'SPV extract';
  setText('wealth-advantage', difference === 0
    ? 'Within £1'
    : `${wealthAdvantage > 0 ? title : 'Personal name'} leads by ${pounds.format(difference)}`);
  setText('wealth-context', `${title} ${pounds.format(selected.endingWealth)} · Personal name ${pounds.format(personal.endingWealth)}`);
  renderBreakEven(result);

  const losses = routeKeys.flatMap((key, index) => {
    const names = ['Personal name', 'SPV extract', 'SPV retain'];
    return result[key].pocketCash < 0
      ? [`${names[index]} requires ${pound.format(-result[key].pocketCash)} a year`]
      : [];
  });
  const lossSummary = document.getElementById('loss-summary');
  lossSummary.textContent = losses.length > 0 ? `${losses.join('. ')}.` : '';
  lossSummary.hidden = losses.length === 0;

  for (const header of routeHeaders) {
    header.toggleAttribute('data-selected', header.dataset.route === route);
  }
  for (const row of annualRows) {
    const measure = row.dataset.measure;
    for (const [index, key] of routeKeys.entries()) {
      const value = result[key][measure];
      const cell = row.cells[index + 1];
      cell.textContent = value == null
        ? '—'
        : measure === 'effectiveTaxRate' ? `${percentage.format(value)}%` : pound.format(value);
    }
  }

  const rows = result.years.map(year => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year.year;
    row.append(heading);
    for (const key of routeKeys) row.insertCell().textContent = pounds.format(year[key]);
    return row;
  });
  projection.replaceChildren(...rows);
}

function update() {
  const invalid = inputs.find(input => !input.validity.valid);
  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = `${label} — ${invalid.validationMessage}`;
    error.hidden = false;
    results.hidden = true;
    setText('loan-amount', '—');
    setText('current-spread', '—');
    return;
  }
  const values = Object.fromEntries(inputs.map(input => [input.id, input.valueAsNumber]));
  render(compare({ ...values, strategy: form.querySelector('#strategy').value }));
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
