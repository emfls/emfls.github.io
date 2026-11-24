import {calculate} from './model.mjs';

const form = document.querySelector('form');
const error = document.getElementById('input-error');
const money = new Intl.NumberFormat('en-CA', {style: 'currency', currency: 'CAD'});

function render() {
  const result = calculate(Object.fromEntries(new FormData(form)));
  for (const output of document.querySelectorAll('[data-result]')) {
    const value = result[output.dataset.result];
    const format = output.dataset.format;
    if (format === 'money') output.textContent = money.format(value / 100);
    else output.textContent = String(value);
  }
  const rows = result.schedule.map(({year, first, second}) => {
    const row = document.createElement('tr');
    for (const [i, text] of [year, money.format(first / 100), money.format(second / 100)].entries()) {
      const cell = document.createElement(i ? 'td' : 'th');
      if (!i) cell.scope = 'row';
      cell.textContent = String(text);
      row.append(cell);
    }
    return row;
  });
  document.querySelector('[data-schedule]').replaceChildren(...rows);
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
