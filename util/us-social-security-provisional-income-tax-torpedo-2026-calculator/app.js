import { simulateWithdrawal } from './model.mjs';

const form = document.getElementById('tax-form');
const error = document.getElementById('input-error');
const estimate = document.getElementById('estimate');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });

function field(id) {
  return document.getElementById(id);
}

function show(id, text) {
  field(id).textContent = text;
}

function render() {
  const inputs = form.querySelectorAll('input');
  let firstInvalid;
  for (const input of inputs) {
    if (input.validity.valid) {
      input.removeAttribute('aria-invalid');
    } else {
      input.setAttribute('aria-invalid', 'true');
      firstInvalid ??= input;
    }
  }

  if (firstInvalid) {
    const label = firstInvalid.labels[0].textContent;
    error.textContent = `${label} — ${firstInvalid.validationMessage}`;
    error.hidden = false;
    estimate.hidden = true;
    return;
  }

  const result = simulateWithdrawal({
    filingStatus: field('filing-status').value,
    annualSocialSecurity: field('benefits').valueAsNumber,
    nonSsAgi: field('other-income').valueAsNumber,
    taxExemptMuniInterest: field('muni-interest').valueAsNumber,
    plannedWithdrawal: field('withdrawal').valueAsNumber,
    marginalRate: Number(field('rate').value),
  });

  show('provisional-income', currency.format(result.provisionalIncome));
  show('taxable-benefits', `${currency.format(result.taxableSocialSecurity)} (${percent.format(result.taxableShare)})`);
  show('next-thousand-rate', `${percent.format(result.nextThousandRate)} (${currency.format(result.nextThousandTax)} tax)`);
  show('tax-saved', currency.format(result.plannedTaxSaved));
  show('added-taxable-benefits', currency.format(result.plannedAddedTaxableSocialSecurity));
  show('traditional-tax', currency.format(result.plannedTraditionalTax));
  show('alternative-tax', currency.format(result.plannedAlternativeTax));

  error.hidden = true;
  error.textContent = '';
  estimate.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
