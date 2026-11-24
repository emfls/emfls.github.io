import { calculate } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('calculator');
const results = get('results');
const error = get('input-error');
const eligibility = get('ineligible');
const fields = [...form.querySelectorAll('input, select')];
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const money = value => dollars.format(value);
const rate = value => percent.format(value / 100);

function makeYearRow({ year, interest, deduction, taxSavings }) {
  const row = document.createElement('tr');
  const label = document.createElement('th');
  label.scope = 'row';
  label.textContent = year;
  row.append(label);
  for (const value of [interest, deduction, taxSavings]) {
    row.insertCell().textContent = money(value);
  }
  return row;
}

function render() {
  const invalid = fields.find(field => !field.validity.valid);
  for (const field of fields) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }

  const values = Object.fromEntries(fields.map(field => {
    if (field.type === 'number') return [field.id, field.valueAsNumber];
    if (field.type === 'checkbox') return [field.id, field.checked];
    return [field.id, field.value];
  }));

  let estimate;
  try {
    if (invalid) {
      const label = invalid.labels?.[0]?.textContent.trim() ?? 'Loan details';
      throw new RangeError(label + ' — ' + invalid.validationMessage);
    }
    estimate = calculate(values);
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const {
    years, monthlyPayment, afterTaxApr, totalTaxSavings, totalInterest, netInterest,
    outsideWindowInterest, disqualifications, maxDeduction, reduction, taxableIncome, marginalRate,
  } = estimate;
  error.hidden = true;
  error.textContent = '';
  eligibility.hidden = disqualifications.length === 0;
  eligibility.textContent = disqualifications.length
    ? 'This loan is ineligible. ' + disqualifications.join(' ')
    : '';

  get('savings2026').textContent = money(years[1].taxSavings);
  get('afterTaxApr').textContent = rate(afterTaxApr) + ' vs ' + rate(values.apr) + ' nominal';
  get('totalSavings').textContent = money(totalTaxSavings);
  get('payment').textContent = money(monthlyPayment);
  const bracket = taxableIncome > 0
    ? '2026 marginal federal bracket ' + marginalRate + '%.'
    : 'Estimated taxable income is $0.';
  get('tax-context').textContent = bracket + ' The MAGI reduction is ' + money(reduction)
    + ' per year after the $10,000 cap, leaving an income-based maximum of '
    + money(maxDeduction) + ' per year.';
  get('years').replaceChildren(...years.map(makeYearRow));
  get('net-cost').textContent = 'This loan costs ' + money(totalInterest)
    + ' in lifetime interest. After ' + money(totalTaxSavings) + ' in estimated tax savings, '
    + money(netInterest) + ' remains. Interest paid outside 2025–2028 totals '
    + money(outsideWindowInterest) + '.';
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
