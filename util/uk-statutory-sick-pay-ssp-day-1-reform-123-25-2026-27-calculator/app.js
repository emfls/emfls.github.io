import { calculateSSP } from './model.mjs';

const form = document.querySelector('#ssp-form');
const comparison = document.querySelector('#comparison');
const error = document.querySelector('#error');
const inputs = [...form.querySelectorAll('input')];
const sickDays = form.querySelector('#sick-days');
const fullPayDays = form.querySelector('#full-pay-days');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const signedMoney = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', signDisplay: 'exceptZero',
});

function renderPeriod(prefix, period) {
  const amounts = {
    ssp: period.statutoryTotal,
    weekly: period.weeklyRate,
    daily: period.dailyRate,
    included: period.statutoryIncluded,
    standalone: period.standaloneSSP,
    gross: period.grossSickPay,
    net: period.netSickPay,
  };
  for (const [name, amount] of Object.entries(amounts)) {
    document.getElementById(`${prefix}-${name}`).textContent = money.format(amount);
  }
  document.getElementById(`${prefix}-days`).textContent = period.statutoryDays;
}

function renderChange(id, amount) {
  const element = document.getElementById(id);
  element.textContent = signedMoney.format(amount);
  element.classList.toggle('loss', amount < 0);
}

function update() {
  fullPayDays.max = Number.isInteger(sickDays.valueAsNumber) && sickDays.validity.valid ? sickDays.value : '140';
  const invalid = inputs.find(input => !input.validity.valid);
  for (const input of inputs) {
    if (input.validity.valid) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
  }

  try {
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    const result = calculateSSP({
      averageWeeklyEarnings: form.querySelector('#earnings').valueAsNumber,
      qualifyingDaysPerWeek: form.querySelector('#workdays').valueAsNumber,
      sickDays: sickDays.valueAsNumber,
      fullPayDays: fullPayDays.valueAsNumber,
      incomeTaxRate: form.querySelector('#income-tax').valueAsNumber,
      nationalInsuranceRate: form.querySelector('#ni').valueAsNumber,
    });

    renderPeriod('current', result.current);
    renderPeriod('previous', result.previous);
    renderChange('statutory-change', result.statutoryChange);
    renderChange('gross-change', result.grossChange);
    document.querySelector('#net-change').textContent =
      `Estimated change in take-home sick pay ${signedMoney.format(result.netChange)}`;
    error.textContent = '';
    comparison.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    comparison.hidden = true;
    error.textContent = issue.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
