import {calculate} from './model.mjs';

const form = document.querySelector('form');
const error = document.getElementById('input-error');
const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

function render() {
  const result = calculate(Object.fromEntries(new FormData(form)));
  const [benefit62, benefit67, benefit70] = result.benefits;
  Object.assign(result, {benefit62, benefit67, benefit70});
  for (const output of document.querySelectorAll('[data-result]')) {
    const value = result[output.dataset.result];
    const format = output.dataset.format;
    if (format === 'money') output.textContent = money.format(value / 100);
    else if (format === 'age') output.textContent = value === null ? 'No crossover by age 120' :
      Math.floor(value / 12) + ' years ' + value % 12 + ' months';
    else output.textContent = String(value);
  }
  error.hidden = true;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    render();
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message + ' Results still show the last valid calculation.';
    error.hidden = false;
  }
});

form.querySelector('fieldset').disabled = false;
render();
