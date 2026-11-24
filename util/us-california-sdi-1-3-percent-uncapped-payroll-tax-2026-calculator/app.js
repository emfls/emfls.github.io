import { calculate } from './model.mjs';

const form = document.getElementById('sdi-form');
const error = document.getElementById('input-error');
const results = document.getElementById('estimate');
const summary = document.getElementById('estimate-announcement');
const amounts = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const rates = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const outputs = [...results.querySelectorAll('[data-result]')];

function update() {
  try {
    if (Array.from(form.elements).some(input => input.validity.badInput)) {
      throw new RangeError('Enter a valid number in each amount field.');
    }

    const { salary, rsu, bonus, nso, payPeriods, status } = form.elements;
    const estimate = calculate({
      salary: Number(salary.value),
      rsu: Number(rsu.value),
      bonus: Number(bonus.value),
      nso: Number(nso.value),
      payPeriods: Number(payPeriods.value),
      status: status.value,
    });

    for (const output of outputs) {
      const key = output.dataset.result;
      const format = key.endsWith('Rate') ? rates : amounts;
      output.textContent = format.format(estimate[key]);
    }
    error.textContent = '';
    error.hidden = true;
    results.hidden = false;
    summary.textContent = `Annual SDI ${amounts.format(estimate.sdi)}. Average per paycheck ${amounts.format(estimate.perPaycheck)}.`;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    summary.textContent = '';
    error.hidden = false;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
