import { calculatePay, isAmount } from './model.mjs';

const form = document.querySelector('#pay-form');
const amount = form.querySelector('#amount');
const deductions = form.querySelector('#deductions');
const medicareThreshold = form.querySelector('#medicare-threshold');
const payType = form.querySelector('#pay-type');
const hasHelp = form.querySelector('#has-help');
const applyMls = form.querySelector('#apply-mls');
const error = document.querySelector('#form-error');
const monthlyNet = document.querySelector('#monthly-net');
const annualSuper = document.querySelector('#annual-super');
const annualSavings = document.querySelector('#annual-savings');
const rows = document.querySelectorAll('#pay-rows [data-pay]');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

function showMoney(element, value) {
  element.textContent = value === undefined ? '—' : money.format(value);
}

function render() {
  const numericInputs = [amount, deductions, medicareThreshold];
  const invalid = numericInputs.filter(input => !input.validity.valid || !isAmount(input.valueAsNumber));
  for (const input of numericInputs) {
    input.setAttribute('aria-invalid', String(invalid.includes(input)));
  }

  error.textContent = invalid.length
    ? `Enter ${invalid[0].labels[0].textContent.toLowerCase()} from $0 to $1,000,000,000 with up to two decimal places.`
    : '';

  const result = invalid.length ? undefined : calculatePay({
    amount: amount.valueAsNumber,
    included: payType.value === 'package',
    hasHelp: hasHelp.checked,
    applyMls: applyMls.checked,
    deductions: deductions.valueAsNumber,
    medicareThreshold: medicareThreshold.valueAsNumber,
  });

  showMoney(monthlyNet, result?.cycles[2].net);
  showMoney(annualSuper, result?.annual.superPay);
  showMoney(annualSavings, result?.annual.savings);
  for (const row of rows) {
    row.querySelectorAll('td').forEach((cell, index) => {
      showMoney(cell, result?.cycles[index][row.dataset.pay]);
    });
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
