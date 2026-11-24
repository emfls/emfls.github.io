import { compareWithdrawals, MAX_AMOUNT } from './model.mjs';

const form = document.getElementById('gis-form');
const partnerField = document.getElementById('partner-field');
const comparison = document.getElementById('comparison');
const inputError = document.getElementById('input-error');
const earlyError = document.getElementById('early-error');
const earlyResults = document.getElementById('early-results');
const status = document.getElementById('results-status');
const fields = form.elements;
const outputs = document.querySelectorAll('[data-result]');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const rate = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 });
const halfCent = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 3,
});

let announceTimer;

function render() {
  clearTimeout(announceTimer);
  const category = fields.category.value;
  const single = category === 'single';
  partnerField.hidden = single;
  fields.partnerEmployment.disabled = single;

  const earlyValid = fields.earlyTaxRate.validity.valid;
  earlyError.hidden = earlyValid;
  earlyError.textContent = earlyValid ? '' : 'Enter a pre-65 tax rate from 0% to 100% with up to two decimal places.';
  earlyResults.hidden = !earlyValid;

  const resultFields = [fields.otherIncome, fields.employment, fields.partnerEmployment, fields.withdrawal, fields.taxRate];
  const invalidField = resultFields.find(field => field.willValidate && !field.validity.valid);
  for (const field of [...resultFields, fields.earlyTaxRate]) {
    field.setAttribute('aria-invalid', String(field.willValidate && !field.validity.valid));
  }
  if (invalidField) {
    const label = invalidField.labels[0].textContent;
    const limit = invalidField === fields.taxRate ? '100%' : money.format(MAX_AMOUNT);
    status.textContent = '';
    inputError.textContent = 'Enter a value for “' + label + '” from 0 to ' + limit + ' with up to two decimal places.';
    inputError.hidden = false;
    comparison.hidden = true;
    earlyResults.hidden = true;
    return;
  }

  let result;
  try {
    result = compareWithdrawals({
      category,
      otherIncome: fields.otherIncome.valueAsNumber,
      employment: fields.employment.valueAsNumber,
      partnerEmployment: single ? 0 : fields.partnerEmployment.valueAsNumber,
      withdrawal: fields.withdrawal.valueAsNumber,
      taxRate: fields.taxRate.valueAsNumber,
      earlyTaxRate: earlyValid ? fields.earlyTaxRate.valueAsNumber : undefined,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    status.textContent = '';
    inputError.textContent = error.message;
    inputError.hidden = false;
    comparison.hidden = true;
    earlyResults.hidden = true;
    return;
  }

  inputError.hidden = true;
  comparison.hidden = false;
  for (const output of outputs) {
    const key = output.dataset.result;
    const value = result[key];
    if (key === 'effectiveRate') {
      output.textContent = value === null ? '—' : rate.format(value) + '%';
    } else {
      const formatter = ['assessableIncome', 'rrspAssessableIncome', 'exemptEarnings'].includes(key) ? halfCent : money;
      output.textContent = formatter.format(value);
    }
  }

  const tfsaRate = document.getElementById('tfsa-rate');
  tfsaRate.textContent = result.effectiveRate === null ? '—' : '0%';
  const householdBasis = document.getElementById('household-basis');
  householdBasis.textContent = category === 'bothOas'
    ? 'GIS totals include both partners.'
    : 'GIS totals cover one recipient.';
  if (category === 'allowance') householdBasis.textContent += ' The partner’s Allowance is excluded.';

  const warning = document.getElementById('withdrawal-warning');
  warning.textContent = result.effectiveRate === null
    ? 'Enter a planned withdrawal to see the impact on your spending money.'
    : 'For this withdrawal, using RRSP/RRIF funds costs ' + money.format(result.gisLost)
      + ' in GIS and ' + money.format(result.rrspTax) + ' in estimated income tax.';
  announceTimer = setTimeout(() => {
    status.textContent = 'Extra annual cash with TFSA ' + money.format(result.annualTfsaAdvantage) + '.';
  }, 400);
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
fields.earlyTaxRate.addEventListener('input', render);
render();
