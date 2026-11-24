import { compareErcSwitch } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('erc-form');
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

function updateChart(costCurrent, costNew) {
  show('chart-caption', 'Total financial outlay over remaining fix term');
  show('chart-desc', `Cost of staying: ${pounds.format(costCurrent)}. Cost of switching: ${pounds.format(costNew)}.`);
  const scale = Math.max(costCurrent, costNew, 1);
  const barCurr = get('bar-cost-current');
  const barNew = get('bar-cost-new');
  if (barCurr) barCurr.setAttribute('width', String(Math.max(4, 380 * (costCurrent / scale))));
  if (barNew) barNew.setAttribute('width', String(Math.max(4, 380 * (costNew / scale))));
  money('bar-val-current', costCurrent);
  money('bar-val-new', costNew);
}

function render(res) {
  const isProfitable = res.isSwitchProfitable;
  const netAmount = Math.abs(res.netSwitchingAdvantage);

  show('primary-label', isProfitable ? 'Net savings by breaking fix early' : 'Net loss if breaking fix early');
  money('primary-value', netAmount);
  show('secondary-value', percent.format(res.breakevenNewRate));
  show('live-summary', `${isProfitable ? 'Switching early saves' : 'Staying on current deal saves'} ${pounds.format(netAmount)} over ${res.remainingFixMonths} months. Monthly payment drops by ${pounds.format(res.monthlyPaymentSavings)}. ERC switching cost: ${pounds.format(res.totalSwitchingCosts)}.`);

  // ERC summary
  money('erc-charge-val', res.ercChargeAmount);
  money('total-switching-cost-val', res.totalSwitchingCosts);

  // Monthly comparison
  money('curr-monthly-pmt', res.currentDeal.monthlyPayment);
  money('new-monthly-pmt', res.newDeal.monthlyPayment);
  money('monthly-savings-val', res.monthlyPaymentSavings);

  // Term comparison
  money('curr-total-cost', res.currentDeal.trueCost);
  money('new-total-cost', res.newDeal.trueCost);
  money('net-term-advantage', netAmount);
  show('net-term-badge', isProfitable ? 'Profitable to switch early' : 'Cheaper to wait out deal');
  show('breakeven-rate-val', percent.format(res.breakevenNewRate));

  updateChart(res.currentDeal.trueCost, res.newDeal.trueCost);
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
    currentBalance: Number(get('mortgage-bal').value),
    currentRate: Number(get('curr-rate').value) / 100,
    remainingFixMonths: Number(get('rem-fix-mo').value),
    remainingTermMonths: Number(get('rem-term-mo').value),
    ercPercentage: Number(get('erc-pct').value),
    overpaymentAllowancePct: Number(get('allowance-pct').value || 10),
    cashToOverpay: Number(get('cash-overpay').value || 0),
    newRate: Number(get('new-rate').value) / 100,
    newArrangementFee: Number(get('new-fee').value || 999)
  };

  try {
    const res = compareErcSwitch(inputs);
    render(res);
  } catch (err) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = err.message;
  }
}

function setPreset(erc) {
  get('erc-pct').value = String(erc);
  update();
}

form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
get('preset-erc2').addEventListener('click', () => setPreset(2.0));
get('preset-erc3').addEventListener('click', () => setPreset(3.0));
update();
