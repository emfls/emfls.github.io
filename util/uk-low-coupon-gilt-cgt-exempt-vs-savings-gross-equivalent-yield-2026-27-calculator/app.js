import { calculateGilt, DEFAULTS, PRESETS, TAX_BANDS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('gilt-form');
const results = byId('results');
const error = byId('error');
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const moneyFields = ['nominal', 'capitalGain', 'couponTotal', 'couponTax', 'fees', 'netProfit', 'benchmarkProfit'];
const yieldFields = ['breakEvenAer', 'netYield', 'noPsaEquivalent'];

function renderBreakdown({ capitalGain, couponTotal, couponTax, fees }) {
  const segments = [
    ['gainBar', capitalGain],
    ['couponBar', couponTotal],
    ['taxBar', -couponTax],
    ['feeBar', -fees],
  ];
  const magnitude = Math.abs(capitalGain) + couponTotal + couponTax + fees;
  const scale = magnitude > 0 ? 1000 / magnitude : 0;
  const zero = (Math.max(0, -capitalGain) + couponTax + fees) * scale;
  let debit = zero;
  let credit = zero;

  for (const [id, value] of segments) {
    const width = Math.abs(value) * scale;
    const bar = byId(id);
    if (value < 0) {
      debit -= width;
      bar.setAttribute('x', Math.max(0, debit));
    } else {
      bar.setAttribute('x', credit);
      credit += width;
    }
    bar.setAttribute('width', width);
  }

  const marker = byId('chartZero');
  marker.setAttribute('x1', zero);
  marker.setAttribute('x2', zero);
}

function comparisonText({ advantage, breakEvenAer }) {
  const difference = Math.abs(advantage);
  let outcome = 'The gilt and benchmark match to the nearest penny.';
  if (difference >= 0.005) {
    const winner = advantage > 0 ? 'The gilt' : 'Benchmark savings';
    outcome = `${winner} comes out ${currency.format(difference)} ahead after tax and fees.`;
  }
  if (breakEvenAer === null) {
    return `${outcome} The gilt has a net loss, so no non-negative savings AER matches it.`;
  }
  return outcome;
}

function render() {
  const inputs = Object.fromEntries(Object.keys(DEFAULTS).map(id => {
    const control = byId(id);
    let value = control.valueAsNumber;
    if (id === 'feeUnit') value = control.value;
    if (id === 'band') value = Number(control.value);
    return [id, value];
  }));

  let scenario;
  try {
    scenario = calculateGilt(inputs);
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    error.classList.remove('hidden');
    results.hidden = true;
    return;
  }

  error.classList.add('hidden');
  for (const field of moneyFields) {
    byId(field).textContent = currency.format(scenario[field]);
  }
  for (const field of yieldFields) {
    const value = scenario[field];
    byId(field).textContent = value === null ? 'N/A' : percent.format(value / 100);
  }

  renderBreakdown(scenario);
  results.hidden = false;
  byId('comparison').textContent = comparisonText(scenario);
}

form.addEventListener('input', event => {
  if (event.target.id === 'band') {
    const allowance = TAX_BANDS[event.target.value];
    byId('psa').max = allowance;
    byId('psa').value = allowance;
  }
  if (event.target.id === 'feeUnit') {
    byId('fee').max = event.target.value === 'gbp' ? 100_000_000 : 100;
  }
  render();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});

for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', () => {
    const { price, coupon, years } = PRESETS[button.dataset.preset];
    byId('price').value = price;
    byId('coupon').value = coupon;
    byId('years').value = years;
    render();
  });
}

render();
