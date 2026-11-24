import { calculateBedAndIsa, DIVIDEND_RATES } from './model.mjs';

const form = document.querySelector('#isa-form');
const error = document.querySelector('#input-error');
const results = document.querySelector('#results');
const status = document.querySelector('#result-status');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function update() {
  const data = new FormData(form);
  const numeric = Object.fromEntries(
    Array.from(form.querySelectorAll('input[type="number"]'), field => [field.name, field.valueAsNumber]),
  );
  try {
    const band = Number(data.get('band'));
    const scenarios = calculateBedAndIsa({
      ...numeric,
      sdrt: data.get('asset') === 'chargeable',
      dividendRate: DIVIDEND_RATES[data.get('rates')][band],
    });
    for (const [key, scenario] of Object.entries(scenarios)) {
      for (const cell of results.querySelectorAll(`[data-scenario="${key}"]`)) {
        const metric = cell.dataset.metric;
        const value = scenario[metric];
        if (metric === 'breakEvenMonths') {
          cell.textContent = scenario.sale === 0 ? 'No trade'
            : value === null ? 'Beyond 120 months' : value === 0 ? 'Immediate' : `${value} months`;
        } else {
          cell.textContent = gbp.format(Math.abs(value) < 0.005 ? 0 : value);
        }
      }
    }
    error.textContent = '';
    results.hidden = false;
    status.textContent = `Maximum zero-CGT sale ${gbp.format(scenarios.zeroCgt.sale)}. `
      + `Maximum ISA cash subscription ${gbp.format(scenarios.fullIsa.subscription)}.`;
  } catch (problem) {
    error.textContent = problem.message;
    status.textContent = '';
    results.hidden = true;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
