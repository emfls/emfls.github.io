import { calculateNso } from './model.mjs';

const form = document.getElementById('nso-form');
const results = document.getElementById('nso-results');
const status = document.getElementById('calculation-status');
const error = document.getElementById('input-error');
const gapNote = document.getElementById('gap-note');
const saleIncome = form.elements.saleTaxableIncome;
const dollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function render() {
  const sameYear = form.elements.saleTiming.value === 'sameYearShort';
  saleIncome.disabled = sameYear;
  document.getElementById('sale-income-field').hidden = sameYear;
  document.getElementById('magi-note').textContent = sameYear
    ? 'Use projected 2026 MAGI before this exercise and sale. The calculation adds the exercise spread.'
    : 'Use projected sale-year MAGI before the sale. Include any other income in that year.';

  const inputs = {};
  try {
    for (const field of form.elements) {
      if (!field.name || field.disabled) continue;
      if (!field.validity.valid) {
        throw new Error(`Check ${field.labels[0].textContent.toLowerCase()}. Enter a value in the allowed range and precision.`);
      }
      inputs[field.name] = field.type === 'number' ? field.valueAsNumber : field.value;
    }
    const estimate = calculateNso(inputs);
    for (const output of results.querySelectorAll('[data-amount]')) {
      output.textContent = dollar.format(estimate[output.dataset.amount]);
    }
    const gap = estimate.federalGap;
    if (gap > 0) {
      gapNote.textContent = `Estimated federal income-tax shortfall of ${dollar.format(gap)} on the exercise. This is an amount to reserve, before other payments or credits.`;
    } else if (gap < 0) {
      gapNote.textContent = `Modeled federal withholding exceeds the estimated income tax on the exercise by ${dollar.format(-gap)}.`;
    } else {
      gapNote.textContent = 'Modeled federal withholding matches the estimated income tax on the exercise.';
    }
    results.hidden = false;
    error.hidden = true;
    status.textContent = `W-2 income ${dollar.format(estimate.spread)}. ${gapNote.textContent} After-tax profit is ${dollar.format(estimate.sameDayNetProfit)} for a same-day sale and ${dollar.format(estimate.holdNetProfit)} for holding.`;
  } catch (problem) {
    results.hidden = true;
    status.textContent = '';
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
