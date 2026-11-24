import { compareMortgageOptions } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('mortgage-form');
const error = get('input-error');
const results = get('results');

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function show(id, value) {
  const el = get(id);
  if (el) el.textContent = value;
}

function money(id, amount) {
  show(id, dollars.format(amount));
}

function updateChart(buydownYr1, pointsMo, priceCutMo) {
  show('chart-caption', 'Year 1 monthly payment reduction comparison');
  show('chart-desc', `2-1 Buydown saves ${dollars.format(buydownYr1)}/mo, Points save ${dollars.format(pointsMo)}/mo, Price cut saves ${dollars.format(priceCutMo)}/mo.`);
  const scale = Math.max(buydownYr1, pointsMo, priceCutMo, 1);
  for (const [id, amount] of [
    ['buydown', buydownYr1],
    ['points', pointsMo],
    ['price-cut', priceCutMo]
  ]) {
    const bar = get(`${id}-bar`);
    if (bar) bar.setAttribute('width', String(Math.max(4, 380 * (amount / scale))));
    money(`${id}-bar-val`, amount);
  }
}

function render(res) {
  money('primary-value', res.buydown.yr1MonthlySavings);
  money('secondary-value', res.buydown.escrowCost);
  show('live-summary', `Year 1 savings with 2-1 buydown: ${dollars.format(res.buydown.yr1MonthlySavings)}/mo. Required seller escrow concession: ${dollars.format(res.buydown.escrowCost)}.`);

  money('base-payment', res.baseMonthlyPayment);
  money('loan-amount', res.loanAmount);

  // Buydown
  show('buydown-yr1-rate', percent.format(res.buydown.yr1Rate));
  money('buydown-yr1-pmt', res.buydown.yr1Payment);
  money('buydown-yr1-save', res.buydown.yr1MonthlySavings);
  show('buydown-yr2-rate', percent.format(res.buydown.yr2Rate));
  money('buydown-yr2-pmt', res.buydown.yr2Payment);
  money('buydown-yr2-save', res.buydown.yr2MonthlySavings);
  show('buydown-yr3-rate', percent.format(res.noteRate));
  money('buydown-yr3-pmt', res.buydown.yr3Payment);
  money('buydown-total-escrow', res.buydown.escrowCost);
  money('buydown-3yr-savings', res.buydown.savings3Yr);
  money('buydown-5yr-savings', res.buydown.savings5Yr);

  // Points
  money('points-cost', res.points.cost);
  show('points-rate', percent.format(res.points.newRate));
  money('points-pmt', res.points.monthlyPayment);
  money('points-monthly-save', res.points.monthlySavings);
  money('points-3yr-savings', res.points.savings3Yr);
  money('points-5yr-savings', res.points.savings5Yr);
  show('points-breakeven', isFinite(res.points.breakevenMonths) ? `${res.points.breakevenMonths.toFixed(1)} months (${(res.points.breakevenMonths / 12).toFixed(1)} yrs)` : 'N/A');

  // Price Cut
  money('pricecut-concession', res.priceCut.concession);
  money('pricecut-new-price', res.priceCut.discountedPrice);
  money('pricecut-pmt', res.priceCut.monthlyPayment);
  money('pricecut-monthly-save', res.priceCut.monthlySavings);
  money('pricecut-downpmt-save', res.priceCut.downPaymentSavings);
  money('pricecut-3yr-savings', res.priceCut.savings3Yr);
  money('pricecut-5yr-savings', res.priceCut.savings5Yr);

  updateChart(res.buydown.yr1MonthlySavings, res.points.monthlySavings, res.priceCut.monthlySavings);
}

function update() {
  const invalid = form.querySelector('input:invalid');
  for (const field of form.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
  }
  results.hidden = Boolean(invalid);
  error.hidden = !invalid;
  if (invalid) {
    invalid.setAttribute('aria-invalid', 'true');
    error.textContent = `${invalid.labels?.[0]?.textContent || 'Input'} ${invalid.validationMessage}`;
    return;
  }

  const inputs = {
    homePrice: Number(get('home-price').value),
    downPaymentPct: Number(get('down-payment').value),
    noteRate: Number(get('note-rate').value) / 100,
    termYears: Number(get('term-years').value),
    discountPoints: Number(get('discount-points').value),
    sellerConcession: get('concession-input').value ? Number(get('concession-input').value) : null
  };

  try {
    const res = compareMortgageOptions(inputs);
    render(res);
  } catch (err) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = err.message;
  }
}

function loadExample(profile) {
  form.reset();
  if (profile === 'fha') {
    get('home-price').value = '420000';
    get('down-payment').value = '3.5';
    get('note-rate').value = '6.50';
    get('discount-points').value = '1.75';
    get('concession-input').value = '';
  } else {
    get('home-price').value = '500000';
    get('down-payment').value = '20';
    get('note-rate').value = '6.75';
    get('discount-points').value = '2.0';
    get('concession-input').value = '';
  }
  update();
}

form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
get('example-standard').addEventListener('click', () => loadExample('std'));
get('example-fha').addEventListener('click', () => loadExample('fha'));
update();
