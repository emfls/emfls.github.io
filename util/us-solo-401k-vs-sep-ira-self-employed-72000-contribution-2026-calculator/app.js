import { calculateComparison, LIMITS } from './model.mjs';

const form = document.getElementById('contribution-form');
const { entity, income, ageBand, otherDeferral, marginalRate } = form.elements;
const incomeLabel = document.getElementById('income-label');
const incomeHint = document.getElementById('income-hint');
const error = document.getElementById('input-error');
const warning = document.getElementById('calculation-note');
const result = document.getElementById('comparison-result');
const amounts = [...result.querySelectorAll('[data-amount]')];
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  trailingZeroDisplay: 'stripIfInteger',
});

function render() {
  const scheduleC = entity.value === 'schedule_c';
  incomeLabel.textContent = scheduleC ? 'Net Schedule C profit or loss ($)' : 'Owner W-2 wages ($)';
  incomeHint.textContent = scheduleC
    ? 'Use Schedule C line 31 before retirement contributions.'
    : 'Use eligible compensation from your business. Exclude shareholder distributions.';

  try {
    const comparison = calculateComparison({
      entity: entity.value,
      income: income.valueAsNumber,
      ageBand: ageBand.value,
      otherDeferral: otherDeferral.valueAsNumber,
      marginalRate: marginalRate.valueAsNumber,
    });
    for (const output of amounts) {
      output.textContent = dollars.format(comparison[output.dataset.amount]);
    }

    const notes = [];
    if (comparison.otherDeferralsExceedLimit) {
      const limit = LIMITS.electiveDeferral + LIMITS.catchUpByAge[ageBand.value];
      notes.push(`Day-job deferrals exceed this age band’s ${dollars.format(limit)} limit. Verify the amount and ask your plan administrator about any excess.`);
    }
    if (comparison.soloDeductible < comparison.soloTotal - 0.005) {
      notes.push(`The estimated deductible Solo 401(k) amount is ${dollars.format(comparison.soloDeductible)} under the Publication 560 worksheet. Verify the allowable employer contribution before funding the plan.`);
    }
    if (!scheduleC && comparison.soloCatchUp > 0) {
      notes.push(`If your 2025 FICA wages from this plan sponsor exceeded $150,000, subtract ${dollars.format(comparison.catchUpTaxSavings)} from the tax savings shown to account for Roth catch-up treatment.`);
    }

    warning.textContent = notes.join(' ');
    warning.hidden = notes.length === 0;
    error.textContent = '';
    result.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    result.hidden = true;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
