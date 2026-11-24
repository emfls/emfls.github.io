import { calculateComparison } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('closing-inputs');
const price = byId('purchase-price');
const mortgage = byId('mortgage-amount');
const firstTimeBuyer = byId('first-time-buyer');
const torontoPeriod = byId('toronto-period');
const error = byId('input-error');
const summary = byId('result-summary');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 3 });
const markets = ['bc', 'ontario', 'toronto'];
const comparisonFields = ['gross', 'relief', 'net', 'difference'];
const results = new Map([
  'alberta-transfer', 'alberta-mortgage', 'alberta-total', 'alberta-share', 'alberta-gross', 'alberta-net',
  ...markets.flatMap(market => comparisonFields.map(field => `${market}-${field}`))
].map(id => [id, byId(id)]));

function show(id, value) {
  results.get(id).textContent = value;
}

function render() {
  let estimate;
  try {
    estimate = calculateComparison({
      purchasePrice: price.valueAsNumber,
      mortgageAmount: mortgage.valueAsNumber,
      firstTimeBuyer: firstTimeBuyer.checked,
      torontoPeriod: torontoPeriod.value
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    summary.textContent = '';
    for (const result of results.values()) result.textContent = '—';
    return;
  }

  error.textContent = '';
  const { alberta } = estimate;
  show('alberta-transfer', money.format(alberta.transfer));
  show('alberta-mortgage', money.format(alberta.mortgage));
  show('alberta-total', money.format(alberta.total));
  show('alberta-gross', money.format(alberta.total));
  show('alberta-net', money.format(alberta.total));
  show('alberta-share', percent.format(alberta.share));

  for (const market of markets) {
    for (const field of comparisonFields) {
      show(`${market}-${field}`, money.format(estimate[market][field]));
    }
  }
  summary.textContent = `Alberta registration fees are ${money.format(alberta.total)}. Net transfer taxes are ${money.format(estimate.bc.net)} in BC, ${money.format(estimate.ontario.net)} in Ontario outside Toronto, and ${money.format(estimate.toronto.net)} in Toronto.`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
