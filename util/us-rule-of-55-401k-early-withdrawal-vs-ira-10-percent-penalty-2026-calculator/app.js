import { calculateBridge, PUBLIC_SAFETY_MIN_AGE, STANDARD_MIN_AGE } from './model.mjs';

const form = document.querySelector('#bridge-form');
const results = document.querySelector('#bridge-results');
const warning = document.querySelector('#rollover-warning');
const error = document.querySelector('#bridge-error');
const safety = form.elements.publicSafety;
const service = form.elements.planServiceYears;
const serviceField = document.querySelector('#service-field');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });

const verdicts = {
  age55: 'Eligible · Age 55 calendar-year rule',
  age50: 'Eligible · Public safety age 50 rule',
  service: 'Eligible · Public safety 25-year plan service rule',
  ineligible: 'Ineligible · Separation age requirement unmet'
};

function render() {
  form.elements.ageInSeparationYear.min = safety.checked ? PUBLIC_SAFETY_MIN_AGE : STANDARD_MIN_AGE;
  serviceField.hidden = !safety.checked;
  service.disabled = !safety.checked;
  const invalid = Array.from(form.elements).find(field => !field.disabled && !field.validity.valid);
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent} — ${invalid.validationMessage}`;
    results.hidden = true;
    warning.hidden = true;
    return;
  }

  const values = Object.fromEntries(
    Array.from(form.querySelectorAll('input[type="number"]'), field => [field.name, field.valueAsNumber])
  );
  const estimate = calculateBridge({
    ...values,
    publicSafety: safety.checked,
    planServiceYears: safety.checked ? values.planServiceYears : 0
  });
  const difference = estimate.withholdingDifference;
  const reconciliation = difference > 0 ? `${usd.format(difference)} excess versus estimated income tax`
    : difference < 0 ? `${usd.format(-difference)} estimated income-tax gap`
    : 'Matches estimated income tax';

  const output = {
    verdict: verdicts[estimate.eligibility],
    bridgeMonths: `${estimate.bridgeMonths} months`,
    taxAssumption: `${form.elements.filingStatus.value} · ${percent.format(values.marginalTaxRate / 100)} combined marginal rate entered`,
    reconciliation,
    rolloverMessage: estimate.penaltySaved > 0
      ? `Rolling the separating plan into an IRA could add ${usd.format(estimate.penaltySaved)} in federal additional tax on your modeled bridge withdrawals.`
      : 'This scenario shows no additional tax cost from losing the separation exception on the planned withdrawals.'
  };
  for (const node of document.querySelectorAll('[data-output]')) {
    const key = node.dataset.output;
    node.textContent = output[key] ?? usd.format(estimate[key]);
  }
  error.textContent = '';
  results.hidden = false;
  warning.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
