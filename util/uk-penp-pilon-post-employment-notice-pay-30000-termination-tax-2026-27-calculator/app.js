import { calculateSettlement } from './model.mjs';

const form = document.querySelector('#settlement');
const fields = form.elements;
const byId = id => document.getElementById(id);
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const amounts = ['basicPay', 'noticeUnits', 'payPeriodDays', 'taxablePilon', 'relevantAward',
  'statutoryRedundancy', 'priorQualifyingAwards', 'annualIncome', 'periodEarnings'];
const outputs = document.querySelectorAll('[data-result]');

function update() {
  const method = fields.method.value;
  const wholeMonths = method === 'months';
  byId('notice-label').textContent = wholeMonths ? 'Unworked notice (whole months)' : 'Unworked notice (calendar days)';
  fields.noticeUnits.max = wholeMonths ? '1200' : '36525';
  byId('period-field').hidden = method !== 'days';
  fields.payPeriodDays.disabled = method !== 'days';

  try {
    const inputs = {};
    for (const name of amounts) {
      const field = fields.namedItem(name);
      if (!field.disabled && !field.validity.valid) {
        throw new RangeError(`Check “${field.labels[0].textContent}” and enter a value within the indicated range.`);
      }
      inputs[name] = field.valueAsNumber;
    }
    if (!fields.payeWithheld.validity.valid) {
      throw new RangeError('Enter the PAYE withheld as a cash amount in pounds and pence, or leave it blank.');
    }
    const result = calculateSettlement({
      ...inputs, method, includePilon: fields.includePilon.checked,
      region: fields.region.value, niPeriod: fields.niPeriod.value,
      payeWithheld: fields.payeWithheld.value === '' ? null : fields.payeWithheld.valueAsNumber,
    });
    for (const output of outputs) {
      const value = result[output.dataset.result];
      output.textContent = value === null ? '' : money.format(value);
    }
    byId('payroll-results').hidden = result.payrollNet === null;
    byId('error').textContent = '';
    byId('results').hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    byId('results').hidden = true;
    byId('error').textContent = error.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
