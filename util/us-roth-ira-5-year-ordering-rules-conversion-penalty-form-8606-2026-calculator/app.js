import { calculateRothDistribution } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const conversionList = byId('conversion-list');
const addButton = byId('add-conversion');
const exceptionField = byId('exception');
const error = byId('error');
const results = byId('results');
const fields = [
  'age', 'withdrawalYear', 'firstRothTaxYear', 'withdrawal', 'contributions',
  'agedConversions', 'earnings', 'marginalRate', 'qualifiedExpenses', 'priorHomeDistributions'
];
const bucketRows = new Map(
  [...document.querySelectorAll('[data-bucket]')].map(row => [row.dataset.bucket, row])
);
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
});
const usd = amount => currency.format(amount);
const formatDate = iso => dateFormat.format(new Date(iso));

function updateException() {
  const home = exceptionField.value === 'first_home_10k';
  const education = exceptionField.value === 'qualified_education';
  byId('expenses-field').hidden = !home && !education;
  byId('prior-home-field').hidden = !home;
  byId('expenses-label').textContent = home ? 'Qualified home acquisition costs ($)' : 'Eligible higher education expenses ($)';
  const note = byId('exception-note');
  note.hidden = !home && !education;
  note.textContent = home
    ? 'Enter qualifying costs payable within 120 days of the distribution and prior qualifying first-home IRA distributions.'
    : 'Use qualifying higher education expenses for the withdrawal year after applicable tax-free education assistance.';
}

function clockItem(label, date, met) {
  const item = document.createElement('li');
  item.textContent = `${label} · ${formatDate(date)} (${met ? 'met' : 'pending in the withdrawal year'})`;
  return item;
}

function render(result, input) {
  const home = result.qualifiedHomeAmount > 0;
  byId('safe').textContent = usd(result.maxSafeWithdrawal);
  byId('tax').textContent = usd(result.incomeTax);
  byId('penalty').textContent = usd(result.penalty);
  byId('estimate-detail').textContent = `${usd(result.taxableEarnings)} in taxable earnings. Additional tax includes ${usd(result.recapturePenalty)} from conversion recapture and ${usd(result.earningsPenalty)} from early earnings.`;

  const balanceWarning = byId('balance-warning');
  balanceWarning.hidden = result.unallocated === 0;
  balanceWarning.textContent = result.unallocated > 0
    ? `The entered balance covers ${usd(result.distributed)}. The remaining ${usd(result.unallocated)} is outside this estimate.`
    : '';

  for (const bucket of result.buckets) {
    const row = bucketRows.get(bucket.key);
    row.cells[1].textContent = usd(bucket.withdrawn);
    row.cells[2].textContent = usd(bucket.reportingAmount);
    row.cells[2].hidden = !home;
  }
  byId('report-heading').hidden = !home;
  const homeReport = byId('home-report');
  homeReport.hidden = !home;
  homeReport.textContent = home
    ? `Form 8606 line 20 removes ${usd(result.qualifiedHomeAmount)} of qualified first-home distributions before applying basis to the rest.`
    : '';

  byId('clocks').replaceChildren(
    clockItem('Roth IRA earnings clock', result.earningsClearDate, result.overallClockMet),
    ...result.conversionClocks.map(clock =>
      clockItem(`${clock.year} conversion clock`, clock.clearDate, clock.aged))
  );
  byId('aged-clock').hidden = input.agedConversions === 0;
  byId('filing').textContent = result.form8606Required
    ? 'Generally required for this distribution, even when the taxable amount is zero.'
    : result.distributed === 0
      ? 'No distribution allocated.'
      : 'Generally excluded for this qualified distribution.';
  if (input.withdrawalYear !== 2026) {
    byId('filing').textContent += ' This scenario projects the 2026 rules onto the selected year.';
  }
}

function updateResults() {
  updateException();
  const input = Object.fromEntries(fields.map(id => [id, byId(id).valueAsNumber]));
  input.exception = exceptionField.value;
  input.conversions = [...conversionList.children].map(row => ({
    year: row.querySelector('.conversion-year').valueAsNumber,
    taxable: row.querySelector('.conversion-taxable').valueAsNumber,
    nontaxable: row.querySelector('.conversion-nontaxable').valueAsNumber
  }));

  try {
    render(calculateRothDistribution(input), input);
    results.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
  }
}

function addConversion(year, taxable, nontaxable) {
  const row = byId('conversion-template').content.firstElementChild.cloneNode(true);
  const yearField = row.querySelector('.conversion-year');
  yearField.value = year;
  row.querySelector('.conversion-taxable').value = taxable;
  row.querySelector('.conversion-nontaxable').value = nontaxable;
  row.querySelector('.remove-conversion').addEventListener('click', () => {
    row.remove();
    updateResults();
    addButton.focus();
  });
  conversionList.append(row);
  return yearField;
}

addButton.addEventListener('click', () => {
  const year = byId('withdrawalYear').valueAsNumber;
  addConversion(Number.isInteger(year) ? year : 2026, 0, 0).focus();
  updateResults();
});
form.addEventListener('input', updateResults);
form.addEventListener('submit', event => event.preventDefault());
addConversion(2023, 8000, 4000);
updateResults();
