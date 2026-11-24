import { BENCHMARK_RATE, MAX_TERM, calculateDivision7A } from './model.mjs';

const form = document.querySelector('#division-calculator');
const fields = form.elements;
const results = document.querySelector('#calculation-results');
const schedule = document.querySelector('#schedule');
const error = document.querySelector('#error');
const scheduleHeading = document.querySelector('#schedule-heading');
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol',
});
const displayMoney = value => money.format(Math.abs(value) < 0.005 ? 0 : value);

function render() {
  const term = fields.remainingYears;
  const limit = MAX_TERM[fields.loanType.value];
  term.max = limit;
  fields.customRate.disabled = !fields.useCustomRate.checked;
  fields.customRate.parentElement.hidden = fields.customRate.disabled;

  const invalid = Array.from(fields).find(field => field.willValidate && !field.validity.valid);
  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = label + ' — ' + invalid.validationMessage;
    results.hidden = true;
    return;
  }

  try {
    const annualRate = fields.useCustomRate.checked ? fields.customRate.valueAsNumber / 100 : BENCHMARK_RATE;
    const estimate = calculateDivision7A({
      openingPrincipalBalance: fields.openingBalance.valueAsNumber,
      loanType: fields.loanType.value,
      remainingYears: term.valueAsNumber,
      actualRepaymentMade: fields.actualRepayment.valueAsNumber,
      distributableSurplus: fields.distributableSurplus.valueAsNumber,
      shareholderMarginalRate: Number(fields.marginalRate.value),
      annualRate,
    });

    for (const output of results.querySelectorAll('[data-amount]')) {
      output.textContent = displayMoney(estimate[output.dataset.amount]);
    }
    document.querySelector('#repayment-status').textContent = estimate.shortfall > 0
      ? 'The repayments entered fall short of the calculated minimum.'
      : 'The repayments entered cover the calculated minimum.';
    scheduleHeading.textContent = 'Illustrative schedule at ' +
      (annualRate * 100).toLocaleString('en-AU', { maximumFractionDigits: 4 }) + '% p.a.';
    schedule.replaceChildren(...estimate.schedule.map(row => {
      const tr = document.createElement('tr');
      const year = document.createElement('th');
      year.scope = 'row';
      year.textContent = row.year;
      tr.append(year);
      for (const amount of [row.openingBalance, row.repayment, row.interest, row.principalPaid, row.closingBalance]) {
        tr.insertCell().textContent = displayMoney(amount);
      }
      return tr;
    }));
    error.textContent = '';
    results.hidden = false;
  } catch (exception) {
    error.textContent = exception.message;
    results.hidden = true;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === fields.loanType && fields.remainingYears.valueAsNumber > MAX_TERM[fields.loanType.value]) {
    fields.remainingYears.value = MAX_TERM[fields.loanType.value];
  }
  render();
});
render();
