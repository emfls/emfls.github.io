import { calculateEstateGiftTax } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const giftTaxNotice = document.querySelector('#gift-tax-notice');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const numericInputs = [...form.querySelectorAll('input[type="number"]')];
const moneyOutputs = [...results.querySelectorAll('[data-money]')];
const form709 = document.querySelector('#form-709');

function update() {
  numericInputs.forEach(input => input.removeAttribute('aria-invalid'));
  const invalid = numericInputs.find(input => !input.validity.valid);

  try {
    if (invalid) {
      invalid.setAttribute('aria-invalid', 'true');
      throw new Error(`${invalid.labels[0].textContent} — ${invalid.validationMessage}`);
    }

    const values = Object.fromEntries(numericInputs.map(input => [input.name, input.valueAsNumber]));
    const estimate = calculateEstateGiftTax({ mode: form.elements.namedItem('mode').value, ...values });

    for (const output of moneyOutputs) {
      output.textContent = currency.format(estimate[output.dataset.money]);
    }
    form709.textContent = estimate.form709Required
      ? (form.elements.namedItem('mode').value === 'married_portability'
          ? 'Yes · File to elect gift splitting'
          : 'Yes · Gift exceeds $19,000 per recipient')
      : 'No trigger for the gifts shown';

    giftTaxNotice.hidden = estimate.currentGiftsAboveAvailableExemption === 0;
    giftTaxNotice.textContent = giftTaxNotice.hidden ? '' :
      `${currency.format(estimate.currentGiftsAboveAvailableExemption)} of planned taxable gifts exceeds the available exemption in this scenario. Federal gift tax may be due separately.`;
    results.hidden = false;
    error.textContent = '';
  } catch (issue) {
    results.hidden = true;
    error.textContent = issue.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
