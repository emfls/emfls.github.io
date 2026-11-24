import { calculateHbp, hbpLimit } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const error = byId('input-error');
const results = byId('results');
const schedule = byId('schedule');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const text = (id, value) => { byId(id).textContent = value; };

function readAmount(id) {
  const field = byId(id);
  return !field.required && !field.validity.badInput && field.value === ''
    ? 0
    : field.valueAsNumber;
}

function renderRows(id, rows, grace = false) {
  const fragment = document.createDocumentFragment();
  for (const { year, minimum, repaid, income, balance } of rows) {
    const row = document.createElement('tr');
    if (grace) row.className = 'grace';
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year;
    row.append(heading);
    for (const value of [minimum, repaid, income, balance]) {
      row.insertCell().textContent = money.format(value);
    }
    fragment.append(row);
  }
  byId(id).replaceChildren(fragment);
}

function update() {
  const buyers = Number(byId('buyers').value);
  const yearOption = byId('withdrawalYear').value;
  const before2024Increase = yearOption === '2024-early';
  const withdrawalYear = before2024Increase ? 2024 : Number(yearOption);
  let result;
  try {
    const limit = hbpLimit(buyers, withdrawalYear, before2024Increase);
    byId('withdrawal').max = limit;
    const historical = withdrawalYear === 2024 ? ' The higher limit applies after April 16, 2024.' : '';
    text('hbp-limit', `Up to ${money.format(limit)} total.${historical}`);

    result = calculateHbp({
      buyers,
      withdrawalYear,
      before2024Increase,
      withdrawal: readAmount('withdrawal'),
      fhsa: readAmount('fhsa'),
      taxRate: readAmount('taxRate'),
      missed: readAmount('missed'),
      extra: readAmount('extra')
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = schedule.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  const {
    pool, firstYear, lastYear, firstDueYear, clearedYear, baselineAnnual, baselineMonthly,
    firstDueMinimum, fullMissTax, incomeInclusion, scenarioTax, totalRepaid, graceRows, rows
  } = result;

  text('pool', money.format(pool));
  text('repayment-window', `${firstYear}–${lastYear}`);
  text('due', firstDueYear ? `${firstDueYear} · ${money.format(firstDueMinimum)}` : 'No payment due');
  text('annual', money.format(baselineAnnual));
  text('monthly', money.format(baselineMonthly));
  text('full-tax', money.format(fullMissTax));
  text('scenario', `Entered scenario adds ${money.format(incomeInclusion)} to taxable income and an estimated ${money.format(scenarioTax)} in income tax.`);
  const clear = clearedYear ? `Balance reaches zero in ${clearedYear}.` : 'There is no HBP balance.';
  text('schedule-summary', `${clear} Total returned to retirement accounts: ${money.format(totalRepaid)}.`);
  renderRows('grace-rows', graceRows, true);
  renderRows('repayment-rows', rows);
  results.hidden = schedule.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
