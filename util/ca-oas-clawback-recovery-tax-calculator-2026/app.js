import { calculateOas } from './model.mjs';

const form = document.querySelector('#oas-form');
const results = document.querySelector('#oas-results');
const error = document.querySelector('#oas-error');
const output = Object.fromEntries([...results.querySelectorAll('[data-value]')]
  .map(element => [element.dataset.value, element]));
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });

function render() {
  const invalid = [...form.elements].find(field => !field.validity.valid);
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent.trim()} — ${invalid.validationMessage}`;
    results.hidden = true;
    return;
  }

  const fields = form.elements;
  const estimate = calculateOas({
    incomeYear: Number(fields.incomeYear.value),
    ageBand: fields.ageBand.value,
    netWorldIncome: fields.netWorldIncome.valueAsNumber,
    monthlyBase: fields.monthlyBase.valueAsNumber,
    residenceYears: fields.residenceYears.valueAsNumber,
    deferralMonths: fields.deferralMonths.valueAsNumber,
    replacement: fields.replacement.valueAsNumber,
    marginalRate: fields.marginalRate.valueAsNumber
  });

  error.textContent = '';
  output.payments.textContent = estimate.period.payments;
  output.threshold.textContent = cad.format(estimate.period.threshold);
  output.taxableIncome.textContent = cad.format(fields.netWorldIncome.valueAsNumber);
  output.taxableRecovery.textContent = cad.format(estimate.recovery);
  for (const key of [
    'annualOas', 'monthlyOas', 'recovery', 'monthlyRecovery', 'retainedOas', 'personalElimination',
    'monthlyDeferralGain', 'grossForgone', 'tfsaIncome', 'tfsaRecovery', 'oasSaved',
    'incomeTaxSaved', 'combinedSavings'
  ]) {
    output[key].textContent = estimate[key] === null ? '—' : cad.format(estimate[key]);
  }
  for (const key of ['residenceFraction', 'deferralIncrease', 'effectiveSavingsRate']) {
    output[key].textContent = estimate[key] === null ? '—' : percent.format(estimate[key]);
  }
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();

// Only request ads for placements with a configured display unit.
for (const placement of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (placement.dataset.adSlot.trim()) (window.adsbygoogle ||= []).push({});
}
