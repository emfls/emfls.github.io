import { calculateTopUp, RATES } from './model.mjs';

const form = document.getElementById('pension-form');
const results = document.getElementById('results');
const error = document.getElementById('input-error');
const fields = [...form.querySelectorAll('input, select')];
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });

function update() {
  const input = Object.fromEntries(fields.map(field => [
    field.id,
    field.type === 'number' ? field.valueAsNumber : field.value,
  ]));
  input.taxRate = Number(input.taxRate);
  input.pensionAge = Number(input.pensionAge);

  let estimate;
  try {
    estimate = calculateTopUp(input);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    results.hidden = true;
    return;
  }

  const messages = [];
  if (input.buyYears === 0) {
    messages.push('No years selected for purchase.');
  } else if (estimate.extraAnnualGross === 0) {
    messages.push(input.currentYears + input.futureYears >= RATES.fullYears
      ? 'Your projected years already reach the full rate in this model.'
      : 'The purchase still leaves you below the 10-year minimum in this model.');
  } else if (estimate.crossesMinimum) {
    messages.push('The purchase crosses the 10-year minimum and unlocks pension based on all your qualifying years.');
  }
  if (estimate.excessYears > 0) {
    messages.push(`Years paid for above the model’s 35-year cap: ${estimate.excessYears}.`);
  }
  if (estimate.netBreakEvenYears !== null && estimate.netBreakEvenYears > input.retirementYears) {
    messages.push('After-tax break-even falls beyond the selected retirement length.');
  }

  const duration = years => years === null ? '—' : `${years.toFixed(2)} years`;
  const values = {
    'current-weekly': currency.format(estimate.currentWeekly),
    'current-annual': currency.format(estimate.currentAnnual),
    'baseline-weekly': currency.format(estimate.withoutTopUpWeekly),
    'baseline-annual': currency.format(estimate.withoutTopUpAnnual),
    'projected-weekly': currency.format(estimate.projectedWeekly),
    'projected-annual': currency.format(estimate.projectedAnnual),
    'total-cost': currency.format(estimate.totalCost),
    'extra-gross': currency.format(estimate.extraAnnualGross),
    'extra-net': currency.format(estimate.extraAnnualNet),
    'break-even-gross': duration(estimate.grossBreakEvenYears),
    'break-even-net': duration(estimate.netBreakEvenYears),
    'break-even-age': estimate.breakEvenAge === null ? '—' : estimate.breakEvenAge.toFixed(2),
    'profit-label': `Net profit after ${input.retirementYears} ${input.retirementYears === 1 ? 'year' : 'years'}`,
    'net-profit': currency.format(estimate.netProfit),
    'roi-label': `ROI after ${input.retirementYears} ${input.retirementYears === 1 ? 'year' : 'years'}`,
    roi: estimate.roiPercent === null ? '—' : percent.format(estimate.roiPercent / 100),
    'scenario-note': messages.join(' '),
  };
  for (const [id, value] of Object.entries(values)) {
    const output = document.getElementById(id);
    if (output.textContent !== value) output.textContent = value;
  }
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();

// Queue only display units configured for the page's publisher.
for (const slot of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(slot.dataset.adSlot)) {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
}
