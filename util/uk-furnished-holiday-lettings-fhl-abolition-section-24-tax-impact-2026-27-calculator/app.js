import { calculate } from './model.mjs';

const form = document.querySelector('#calculator');
const fields = [...form.querySelectorAll('input')];
const comparison = document.querySelector('#comparison');
const error = document.querySelector('#input-error');
const amounts = [...comparison.querySelectorAll('[data-money]')];
const cashWarning = document.querySelector('#cash-warning');
const taperWarning = document.querySelector('#taper-warning');
const benefitWarning = document.querySelector('#benefit-warning');
const currency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  trailingZeroDisplay: 'stripIfInteger',
});
const money = amount => currency.format(Math.abs(amount) < 0.005 ? 0 : amount);

function update() {
  for (const field of fields) {
    field.setAttribute('aria-invalid', String(!field.validity.valid));
  }
  const invalid = fields.find(field => !field.validity.valid);
  if (invalid) {
    comparison.hidden = true;
    error.textContent = `Enter an amount between £0 and £100,000,000 for ${invalid.labels[0].textContent.replace(' (£)', '').toLowerCase()}.`;
    error.hidden = false;
    return;
  }

  const inputs = Object.fromEntries(fields.map(field => [field.name, field.valueAsNumber]));
  const result = calculate(inputs);
  for (const output of amounts) {
    output.textContent = money(result[output.dataset.money]);
  }
  cashWarning.textContent = `Annual cash after interest, expenses and Income Tax changes from ${money(result.oldAfterTaxCash)} under old FHL rules to ${money(result.newAfterTaxCash)} under Section 24.`;
  taperWarning.hidden = result.newPersonalAllowance >= result.oldPersonalAllowance;
  if (!taperWarning.hidden) {
    taperWarning.textContent = `Your Personal Allowance falls by ${money(result.oldPersonalAllowance - result.newPersonalAllowance)} because Section 24 increases income above the taper threshold.`;
  }

  const before = result.oldChildBenefitChargePercent;
  const after = result.newChildBenefitChargePercent;
  benefitWarning.hidden = after <= before;
  if (!benefitWarning.hidden) {
    benefitWarning.textContent = `If you are the person liable for the High Income Child Benefit Charge, the share of Child Benefit you may have to repay rises from ${before}% to ${after}%.`;
  }

  error.hidden = true;
  comparison.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
