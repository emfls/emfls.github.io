import { calculateEstimatedTax } from './model.mjs';

const form = document.querySelector('#tax-form');
const error = document.querySelector('#error');
const results = document.querySelector('#results');
const summary = document.querySelector('#summary');
const schedule = document.querySelector('#schedule');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

function display(id, value) {
  document.getElementById(id).textContent = value;
}

function showError(message) {
  results.hidden = true;
  summary.textContent = '';
  error.textContent = message;
}

function recalculate() {
  const invalid = [...form.elements].find((field) => !field.validity.valid);
  if (invalid) {
    showError(invalid.labels[0].textContent + ' — ' + invalid.validationMessage);
    return;
  }

  const number = (id) => form.elements.namedItem(id).valueAsNumber;
  let result;
  try {
    result = calculateEstimatedTax({
      filingStatus: form.elements.filingStatus.value,
      prior2025Agi: number('prior-agi'),
      prior2025TotalTax: number('prior-tax'),
      projected2026TotalTax: number('current-tax'),
      totalW2Withholding: number('withholding'),
      quarterlyPayments: [1, 2, 3, 4].map((quarter) => number('payment-' + quarter)),
      annualPenaltyRate: number('penalty-rate'),
    });
  } catch (failure) {
    showError(failure.message);
    return;
  }

  const priorRule = result.priorYearPercent + '% of 2025 tax';
  const rule = {
    current: '90% of projected 2026 tax',
    prior: priorRule,
    tie: 'Tie between 90% of projected 2026 tax and ' + priorRule,
  }[result.winningRule];
  display('annual-target', dollars.format(result.requiredAnnual));
  display('winning-rule', rule);
  display('quarterly-target', dollars.format(result.quarterlyPayment));
  display('net-needed', dollars.format(result.netEstimatedNeeded));
  display('shortfall', dollars.format(result.yearEndShortfall));
  display('penalty', dollars.format(result.estimatedPenalty));
  display('penalty-status', result.hasUnderpayment
    ? 'This plan falls short on at least one payment deadline.'
    : 'This plan meets the modeled payment requirement on all four deadlines.');
  display('prong-comparison', '90% of projected 2026 tax = ' + dollars.format(result.currentYearProng)
    + ' · ' + priorRule + ' = ' + dollars.format(result.priorYearProng));
  display('exception-status', result.deMinimis
    ? 'The projected balance after withholding is under $1,000. The small-balance exception makes estimated payments unnecessary under these inputs.'
    : '');
  summary.textContent = rule + '. Minimum equal quarterly payment '
    + dollars.format(result.quarterlyPayment) + '. Estimated penalty '
    + dollars.format(result.estimatedPenalty) + '.';

  result.schedule.forEach((quarter, index) => {
    const cells = schedule.rows[index].cells;
    const date = cells[1].querySelector('time');
    date.dateTime = quarter.date;
    date.textContent = dateFormat.format(new Date(quarter.date));
    cells[2].textContent = dollars.format(quarter.minimumPayment);
    cells[3].textContent = dollars.format(quarter.plannedPayment);
    cells[4].textContent = dollars.format(quarter.shortfall);
  });
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', recalculate);
recalculate();
