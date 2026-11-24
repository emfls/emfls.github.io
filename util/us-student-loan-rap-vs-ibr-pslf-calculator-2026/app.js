import { comparePlans } from './model.mjs';

const form = document.querySelector('#loan-form');
const results = document.querySelector('#comparison');
const status = document.querySelector('#status');
const taxInput = form.elements.namedItem('taxRate');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollars = (value) => currency.format(value);

function showDifference(id, left, right, savings) {
  const difference = Math.round(Math.abs(savings) * 100);
  const message = difference === 0
    ? `${left} and ${right} cost the same.`
    : `${left} costs ${dollars(Math.abs(savings))} ${savings > 0 ? 'less' : 'more'} than ${right}.`;
  document.getElementById(id).textContent = message;
}

function render() {
  const fields = form.elements;
  const pslf = fields.pslf.checked;
  taxInput.disabled = pslf;
  const invalid = [...fields].filter((field) => field.willValidate && !field.validity.valid);
  for (const field of fields) field.toggleAttribute('aria-invalid', invalid.includes(field));
  results.hidden = invalid.length > 0;
  if (invalid.length) {
    status.textContent = `${invalid[0].labels[0].textContent}: ${invalid[0].validationMessage}`;
    return;
  }

  const data = comparePlans({
    balance: fields.balance.valueAsNumber,
    annualRate: fields.annualRate.valueAsNumber,
    agi: fields.agi.valueAsNumber,
    dependents: fields.dependents.valueAsNumber,
    familySize: fields.familySize.valueAsNumber,
    region: fields.region.value,
    ibrPlan: fields.ibrPlan.value,
    pslf,
    taxRate: pslf ? 0 : taxInput.valueAsNumber,
  });

  for (const name of ['rap', 'ibr', 'standard']) {
    const plan = data[name];
    const card = document.getElementById(name);
    for (const cell of card.querySelectorAll('[data-value]')) {
      const key = cell.dataset.value;
      cell.textContent = dollars(plan[key]);
    }
    card.querySelector('[data-end]').textContent = plan.forgiven > 0
      ? `${pslf ? 'PSLF' : 'IDR forgiveness'} after ${plan.months} months`
      : plan.months ? `Paid off in ${plan.months} months` : 'No balance';
  }

  document.getElementById('interest-waived').textContent = dollars(data.rap.waivedInterest);
  document.getElementById('principal-match').textContent = dollars(data.rap.principalMatch);
  document.getElementById('threshold').textContent = dollars(1.5 * data.guideline);
  showDifference('rap-ibr', 'RAP', 'IBR', data.rapVsIbr);
  showDifference('rap-standard', 'RAP', '10-year Standard', data.rapVsStandard);
  showDifference('ibr-standard', 'IBR', '10-year Standard', data.ibrVsStandard);
  status.textContent = pslf
    ? 'PSLF scenario · 120 qualifying months · $0 federal tax on forgiveness'
    : 'Regular repayment scenario · Estimated tax applies to IDR forgiveness';
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
