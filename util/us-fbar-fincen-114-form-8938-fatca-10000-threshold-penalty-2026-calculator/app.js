import { calculate } from './model.mjs';

const form = document.querySelector('#calculator');
const error = document.querySelector('#error');
const results = document.querySelector('#results');
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const fields = form.elements;

function readAmount(name) {
  const field = fields.namedItem(name);
  if (!field.validity.valid || !Number.isFinite(field.valueAsNumber)) {
    const label = field.labels[0].textContent;
    const precision = field.step === '1' ? 'a whole number' : 'an amount with up to two decimal places';
    throw new RangeError(`Enter ${precision} of zero or more for “${label}”.`);
  }
  return field.valueAsNumber;
}

function show(id, value) {
  document.getElementById(id).textContent = value;
}

function update() {
  try {
    const filesIncomeTaxReturn = fields.namedItem('filesIncomeTaxReturn').value === 'yes';
    const estimate = calculate({
      filingStatus: fields.namedItem('filingStatus').value,
      residence: fields.namedItem('residence').value,
      filesIncomeTaxReturn,
      fbarPeak: readAmount('fbarPeak'),
      fatcaYearEnd: readAmount('fatcaYearEnd'),
      fatcaPeak: readAmount('fatcaPeak'),
      missedFbarYears: readAmount('missedFbarYears'),
      missedFatcaYears: readAmount('missedFatcaYears'),
      violationBalance: readAmount('violationBalance'),
      daysSinceNotice: readAmount('daysSinceNotice'),
      streamlinedBase: readAmount('streamlinedBase'),
    });
    const { yearEnd, peak } = estimate.fatcaThresholds;
    show('fbarRequired', estimate.fbarRequired ? 'YES' : 'NO');
    show('fatcaRequired', estimate.fatcaRequired ? 'YES' : 'NO');
    show('active-threshold', filesIncomeTaxReturn
      ? `Over ${dollars.format(yearEnd)} at year-end or over ${dollars.format(peak)} on any day.`
      : 'Form 8938 is only required with a required U.S. income tax return.');
    for (const key of ['nonWillful', 'willful', 'fatcaMaximum', 'fatcaNoticeScenario', 'sdop', 'sfop']) {
      show(key, dollars.format(estimate[key]));
    }
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
