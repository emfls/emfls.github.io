import { calculateRentalTax } from './model.mjs';

const form = document.getElementById('rental-inputs');
const error = document.getElementById('input-error');
const results = document.getElementById('results');
const settlementStatus = document.getElementById('settlement');
const shortfall = document.getElementById('shortfall');
const numberInputs = [...form.querySelectorAll('input[type="number"]')];
const outputs = [...results.querySelectorAll('[data-result]')];
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

function formatMoney(amount) {
  return currency.format(Math.abs(amount) < 0.005 ? 0 : amount);
}

function updateEstimate() {
  for (const input of numberInputs) {
    if (input.validity.valid) {
      input.removeAttribute('aria-invalid');
    } else {
      input.setAttribute('aria-invalid', 'true');
    }
  }

  const invalid = numberInputs.find(input => !input.validity.valid);
  if (invalid) {
    error.textContent = `Check “${invalid.labels[0].textContent}”: ${invalid.validationMessage}`;
    results.hidden = true;
    shortfall.textContent = '—';
    return;
  }

  const inputs = Object.fromEntries(numberInputs.map(input => [
    input.name, input.value === '' ? 0 : input.valueAsNumber,
  ]));
  inputs.withholdingMethod = form.elements.withholdingMethod.value;
  const estimate = calculateRentalTax(inputs);

  for (const output of outputs) {
    output.textContent = formatMoney(estimate[output.dataset.result]);
  }
  const settlement = estimate.refund >= 0.005
    ? `Estimated CRA refund: ${formatMoney(estimate.refund)}`
    : estimate.balanceOwing >= 0.005
      ? `Estimated CRA balance owing: ${formatMoney(estimate.balanceOwing)}`
      : 'Estimated CRA settlement: $0.00';
  settlementStatus.textContent = settlement;
  shortfall.textContent = formatMoney(estimate.missedDeadlineShortfall);
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', updateEstimate);
form.addEventListener('submit', event => {
  event.preventDefault();
  updateEstimate();
});
updateEstimate();
