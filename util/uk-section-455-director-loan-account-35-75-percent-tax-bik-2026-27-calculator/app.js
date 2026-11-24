import { calculateDirectorLoan } from './model.mjs';

const form = document.querySelector('#dla-form');
const fields = form.elements;
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const redraw = document.querySelector('#redraw-field');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function render() {
  const matchRepayment = fields.matchRepayment.checked;
  redraw.hidden = !matchRepayment;
  fields.matchedAmount.disabled = !matchRepayment;

  const invalid = form.querySelector(':invalid');
  if (invalid) {
    const label = invalid.labels[0].textContent;
    results.hidden = true;
    error.textContent = `${label}. ${invalid.validationMessage}`;
    return;
  }

  let estimate;
  try {
    estimate = calculateDirectorLoan({
      regime: fields.regime.value,
      peakBalance: fields.peakBalance.valueAsNumber,
      deadlineBalance: fields.deadlineBalance.valueAsNumber,
      daysOverdrawn: fields.daysOverdrawn.valueAsNumber,
      interestPaid: fields.interestPaid.valueAsNumber,
      directorBand: Number(fields.directorBand.value),
      matchRepayment,
      matchedAmount: fields.matchedAmount.valueAsNumber,
    });
  } catch (problem) {
    results.hidden = true;
    error.textContent = problem.message;
    return;
  }

  error.textContent = '';
  for (const item of results.querySelectorAll('[data-money]')) {
    item.textContent = money.format(estimate[item.dataset.money]);
  }
  for (const [index, item] of [...results.querySelectorAll('[data-dividend-tax]')].entries()) {
    item.textContent = money.format(estimate.dividendTaxes[index].tax);
  }
  results.querySelector('#s455-rate').textContent = `${estimate.section455Rate}%`;
  results.querySelector('#bik-status').textContent = estimate.bikExempt
    ? 'Small-loan exemption applies on the peak entered.'
    : 'The peak exceeds £10,000. The estimate uses the full balance.';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
