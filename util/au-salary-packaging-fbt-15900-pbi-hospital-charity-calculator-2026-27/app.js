import { calculatePackaging } from './model.mjs';

const form = document.getElementById('packaging-form');
const results = document.getElementById('results');
const error = document.getElementById('error');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD',
  currencyDisplay: 'code' });
const money = value => currency.format(Math.abs(value) < 0.005 ? 0 : value);

function render() {
  const invalid = [...form.querySelectorAll('input[type="number"]')].find(input => !input.validity.valid);
  try {
    if (invalid) {
      throw new RangeError(`Check ${invalid.labels[0].textContent.toLowerCase()} and enter a valid amount.`);
    }
    const fields = form.elements;
    const result = calculatePackaging({
      salary: fields.salary.valueAsNumber,
      sector: fields.sector.value,
      living: fields.living.valueAsNumber,
      meals: fields.meals.valueAsNumber,
      livingType: fields.livingType.value,
      mealsType: fields.mealsType.value,
      annualFee: fields.annualFee.valueAsNumber,
      helpBalance: fields.helpBalance.valueAsNumber,
      hospitalCover: fields.hospitalCover.checked,
      passThroughFbt: fields.passThroughFbt.checked,
    });

    for (const output of results.querySelectorAll('[data-money]')) {
      const [key, field] = output.dataset.money.split('.');
      output.textContent = money(field ? result[key][field] : result[key]);
    }
    const gain = document.getElementById('gain');
    const change = Math.round(Math.abs(result.annualGain) * 100) === 0
      ? 'No change in spending power'
      : result.annualGain < 0 ? 'Estimated spending power loss' : 'Estimated spending power gain';
    gain.textContent = change;
    results.dataset.loss = String(result.annualGain < -0.005);
    results.hidden = false;
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
