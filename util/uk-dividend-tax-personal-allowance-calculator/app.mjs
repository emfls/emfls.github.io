import {calculate} from './model.mjs';

const form = document.querySelector('form');
const money = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'});
const error = document.getElementById('input-error');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    const result = calculate({
      ordinary: document.getElementById('ordinary').valueAsNumber,
      dividends: document.getElementById('dividends').valueAsNumber,
    });
    for (const node of document.querySelectorAll('[data-result]')) {
      node.textContent = money.format(result[node.dataset.result]);
    }
    for (const node of document.querySelectorAll('[data-band]')) {
      node.textContent = money.format(result.bands[Number(node.dataset.band)]);
    }
    error.hidden = true;
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    error.textContent = e.message;
    error.hidden = false;
  }
});

form.querySelector('fieldset').disabled = false;
