import { calculateWithholding, FX_YEARS } from './model.mjs';

const form = document.querySelector('#fwt-inputs');
const results = document.querySelector('#fwt-results');
const error = document.querySelector('#fwt-error');
const announcement = document.querySelector('#fwt-status');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const decimal = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 3 });

function show(id, text) {
  document.getElementById(id).textContent = text;
}

function formatYears(years) {
  if (years === null) return 'No break-even';
  if (years === 0) return 'Immediate';
  if (years < 0.01) return '<0.01 year';
  const rounded = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(years);
  return `${rounded} ${years === 1 ? 'year' : 'years'}${years > FX_YEARS ? ' (beyond 20 years)' : ''}`;
}

function update() {
  const inputs = [...form.querySelectorAll('input')];
  const invalid = inputs.find(input => !input.validity.valid);
  results.hidden = Boolean(invalid);
  if (invalid) {
    error.textContent = `Enter ${invalid.labels[0].textContent.trim().toLowerCase()} from ${invalid.min} to ${invalid.max}.`;
    announcement.textContent = '';
    return;
  }

  error.textContent = '';
  const comparison = calculateWithholding(
    Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]))
  );

  for (const row of results.querySelectorAll('[data-scenario]')) {
    const scenario = comparison[row.dataset.scenario];
    const [withheld, lost, wealth] = row.querySelectorAll('td');
    withheld.textContent = money.format(scenario.firstYearWithheld);
    lost.textContent = `${money.format(scenario.firstYearLost)} (${decimal.format(scenario.annualFwtDragPct)}%)`;
    wealth.textContent = money.format(scenario.wealthLost);
  }

  show('rrsp-gross-savings', money.format(comparison.rrspSwitchGrossSavings));
  for (const row of results.querySelectorAll('[data-conversion]')) {
    const conversion = comparison[row.dataset.conversion];
    const [cost, breakEven, savings] = row.querySelectorAll('td');
    cost.textContent = money.format(conversion.cost);
    breakEven.textContent = formatYears(conversion.breakEvenYears);
    savings.textContent = conversion.netSavingsAt20 === null
      ? 'Cost exceeds balance'
      : money.format(conversion.netSavingsAt20);
  }

  announcement.textContent = `Updated. Estimated 25-year RRSP savings before conversion: ${money.format(comparison.rrspSwitchGrossSavings)}.`;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
