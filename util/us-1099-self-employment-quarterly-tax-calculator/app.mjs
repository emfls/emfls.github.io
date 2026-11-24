import {calculate} from './model.mjs';

const form = document.querySelector('form');
const error = document.getElementById('input-error');

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const result = calculate(Object.fromEntries(new FormData(form)));
    for (const output of document.querySelectorAll('[data-result]')) {
      output.textContent = result[output.dataset.result];
    }
    document.getElementById('result-state').textContent = 'Updated using your inputs';
    error.hidden = true;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = `${problem.message} Results still show the last valid calculation.`;
    error.hidden = false;
  }
});

form.querySelector('fieldset').disabled = false;
