import { calculateNrls } from './model.mjs';

const form = document.getElementById('nrls-form');
const error = document.getElementById('input-error');
const results = document.getElementById('results');
const fields = form.elements;
const amountFields = Array.from(form.querySelectorAll('input[type="number"]'));
const outputFields = Array.from(results.querySelectorAll('[data-output]'));
const agentOptions = document.getElementById('agent-options');
const tenantOptions = document.getElementById('tenant-options');
const balanceLabel = document.getElementById('balance-label');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });

function update() {
  const isAgent = fields.payer.value === 'agent';
  agentOptions.hidden = agentOptions.disabled = !isAgent;
  tenantOptions.hidden = tenantOptions.disabled = isAgent;

  const amounts = {};
  let invalidField;
  for (const field of amountFields) {
    if (field.matches(':disabled')) continue;
    const valid = field.validity.valid;
    if (valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
    if (!valid && !invalidField) invalidField = field;
    amounts[field.name] = field.value === '' ? null : field.valueAsNumber;
  }

  try {
    if (invalidField) {
      const label = invalidField.labels[0].textContent;
      throw new RangeError(label + '. ' + invalidField.validationMessage);
    }
    const values = calculateNrls({
      ...amounts,
      payer: fields.payer.value,
      qualifiesForAllowance: fields.qualifiesForAllowance.value === 'yes',
      hasNrl1GrossApproval: fields.hasNrl1GrossApproval.checked,
      tenantDirectedByHmrc: !isAgent && fields.tenantDirectedByHmrc.checked,
    });
    balanceLabel.textContent = values.refund > 0 ? 'Estimated HMRC refund'
      : values.balancingPayment > 0 ? 'Estimated balancing payment'
      : 'Estimated year-end balance';
    for (const field of outputFields) {
      const key = field.dataset.output;
      const value = key === 'reconciliation' ? values.refund + values.balancingPayment : values[key];
      field.textContent = key === 'netYieldPercent'
        ? (value === null ? 'N/A' : percent.format(value / 100))
        : money.format(value);
    }
    error.textContent = '';
    results.hidden = false;
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    results.hidden = true;
    error.textContent = exception.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
window.addEventListener('pageshow', update);
update();
