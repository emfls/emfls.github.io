import { compareRemortgageDeals } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('remortgage-form');
const error = get('input-error');
const results = get('results');

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function show(id, value) {
  const el = get(id);
  if (el) el.textContent = value;
}

function money(id, amount) {
  show(id, pounds.format(amount));
}

function updateChart(costA, costB) {
  show('chart-caption', 'Total cost over fixed rate term');
  show('chart-desc', `Fee deal total cost: ${pounds.format(costA)}. Fee-free deal total cost: ${pounds.format(costB)}.`);
  const scale = Math.max(costA, costB, 1);
  const barA = get('bar-fee-deal');
  const barB = get('bar-fee-free');
  if (barA) barA.setAttribute('width', String(Math.max(4, 380 * (costA / scale))));
  if (barB) barB.setAttribute('width', String(Math.max(4, 380 * (costB / scale))));
  money('bar-val-fee-deal', costA);
  money('bar-val-fee-free', costB);
}

function render(res) {
  const isFeeCheaper = res.betterDeal === 'fee';
  const netAdvantage = Math.abs(res.netSavingsWithFee);

  show('primary-label', isFeeCheaper ? 'Net savings with fee product' : 'Net savings with fee-free product');
  money('primary-value', netAdvantage);
  money('secondary-value', res.breakevenBalance);
  show('live-summary', `${isFeeCheaper ? 'Fee deal (£' + res.dealA.fee + ')' : 'Fee-free deal'} is cheaper by ${pounds.format(netAdvantage)} over ${res.fixedYears} years. Breakeven mortgage balance: ${pounds.format(res.breakevenBalance)}.`);

  // Deal A
  show('deal-a-rate', percent.format(res.dealA.rate));
  money('deal-a-pmt', res.dealA.monthlyPayment);
  money('deal-a-total-paid', res.dealA.totalPaidOverFix);
  money('deal-a-end-balance', res.dealA.endingBalance);
  money('deal-a-true-cost', res.dealA.trueCostOverFix);

  // Deal B
  show('deal-b-rate', percent.format(res.dealB.rate));
  money('deal-b-pmt', res.dealB.monthlyPayment);
  money('deal-b-total-paid', res.dealB.totalPaidOverFix);
  money('deal-b-end-balance', res.dealB.endingBalance);
  money('deal-b-true-cost', res.dealB.trueCostOverFix);

  // Comparison
  money('monthly-diff', Math.abs(res.monthlySavingsWithFee));
  show('monthly-diff-desc', res.monthlySavingsWithFee >= 0 ? 'lower monthly payment with fee deal' : 'higher monthly payment with fee deal');
  money('net-term-savings', netAdvantage);
  money('breakeven-balance-val', res.breakevenBalance);

  updateChart(res.dealA.trueCostOverFix, res.dealB.trueCostOverFix);
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
    balance: Number(get('mortgage-balance').value),
    termYears: Number(get('mortgage-term').value),
    fixedYears: Number(get('fixed-years').value),
    feeDeal: {
      fee: Number(get('product-fee').value),
      rate: Number(get('fee-rate').value) / 100,
      addFeeToBalance: get('add-fee-mode').value === 'add',
      cashback: Number(get('fee-cashback').value || 0)
    },
    feeFreeDeal: {
      fee: 0,
      rate: Number(get('fee-free-rate').value) / 100,
      cashback: Number(get('fee-free-cashback').value || 0)
    }
  };

  try {
    const res = compareRemortgageDeals(inputs);
    render(res);
  } catch (err) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = err.message;
  }
}

function setPreset(feeAmount) {
  get('product-fee').value = String(feeAmount);
  update();
}

form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
get('preset-999').addEventListener('click', () => setPreset(999));
get('preset-1499').addEventListener('click', () => setPreset(1499));
update();
