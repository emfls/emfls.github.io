import { calculateGiftAid } from './model.mjs';

const form = document.querySelector('#gift-aid-form');
const inputs = [...form.querySelectorAll('input')];
const results = document.querySelector('#results');
const status = document.querySelector('#calculation-status');
const coverage = document.querySelector('#coverage');
const incomeBefore = document.querySelector('#income-before');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const outputs = [...results.querySelectorAll('[data-value]')];

function render() {
  for (const input of inputs) {
    input.setAttribute('aria-invalid', String(!input.validity.valid));
  }
  const invalid = inputs.find(input => !input.validity.valid);
  status.classList.toggle('invalid', Boolean(invalid));
  if (invalid) {
    results.hidden = true;
    status.textContent = `Enter a valid amount in pounds and pence for ${invalid.labels[0].textContent}.`;
    return;
  }

  const values = Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]));
  const estimate = calculateGiftAid(values);
  incomeBefore.textContent = money.format(values.baseAdjustedNetIncome);
  for (const output of outputs) {
    const value = estimate[output.dataset.value];
    if (value === null) {
      output.textContent = '—';
    } else if (output.dataset.format === 'percent') {
      output.textContent = percent.format(value / (output.dataset.value === 'effectiveTaxReliefPct' ? 100 : 1));
    } else {
      output.textContent = money.format(value);
    }
  }

  coverage.classList.toggle('warning', !estimate.hasEnoughTaxForGiftAid);
  coverage.textContent = estimate.hasEnoughTaxForGiftAid
    ? `Tax cover check passed for this gift. Estimated eligible tax is ${money.format(estimate.taxAvailableForGiftAid)}.`
    : `Tax cover shortfall of ${money.format(estimate.giftAidTaxShortfall)}. If the charity claims Gift Aid, the model estimates ${money.format(estimate.extraTaxFromAllowanceRestriction)} in extra tax from a restricted Personal Allowance and a separate charge of ${money.format(estimate.residualGiftAidTaxCharge)}. These amounts add to the net cost shown.`;
  results.hidden = false;
  status.textContent = `Estimated Income Tax saving ${money.format(estimate.personalTaxRefund)}. ${coverage.textContent}`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
