import { calcCanadianMortgageShock } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('renewal-form');
const error = get('input-error');
const results = get('results');

const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function show(id, value) {
  const el = get(id);
  if (el) el.textContent = value;
}

function money(id, amount) {
  show(id, dollars.format(amount));
}

function updateChart(currentPmt, renewalPmt, switchPmt, extendPmt) {
  show('chart-caption', 'Monthly payment shock across renewal options');
  show('chart-desc', `Current payment: ${dollars.format(currentPmt)}, Bank renewal: ${dollars.format(renewalPmt)}, OSFI switch: ${dollars.format(switchPmt)}, Extended amort: ${dollars.format(extendPmt)}.`);
  const scale = Math.max(renewalPmt, 1);
  const barCurr = get('bar-current');
  const barRenew = get('bar-renewal');
  const barSwitch = get('bar-switch');
  const barExtend = get('bar-extend');
  if (barCurr) barCurr.setAttribute('width', String(Math.max(4, 380 * (currentPmt / scale))));
  if (barRenew) barRenew.setAttribute('width', String(Math.max(4, 380 * (renewalPmt / scale))));
  if (barSwitch) barSwitch.setAttribute('width', String(Math.max(4, 380 * (switchPmt / scale))));
  if (barExtend) barExtend.setAttribute('width', String(Math.max(4, 380 * (extendPmt / scale))));
  money('bar-val-current', currentPmt);
  money('bar-val-renewal', renewalPmt);
  money('bar-val-switch', switchPmt);
  money('bar-val-extend', extendPmt);
}

function render(res) {
  money('primary-value', res.statusQuo.paymentShockDollars);
  show('secondary-value', `+${res.statusQuo.paymentShockPct.toFixed(1)}%`);
  show('live-summary', `Payment shock on renewal: +${dollars.format(res.statusQuo.paymentShockDollars)}/month (+${res.statusQuo.paymentShockPct.toFixed(1)}%). Current: ${dollars.format(res.currentPayment)}, New renewal: ${dollars.format(res.statusQuo.monthlyPayment)}.`);

  money('current-pmt-val', res.currentPayment);
  money('renewal-pmt-val', res.statusQuo.monthlyPayment);
  money('shock-dollars-val', res.statusQuo.paymentShockDollars);
  show('shock-pct-val', `+${res.statusQuo.paymentShockPct.toFixed(2)}%`);

  // Switch
  money('switch-pmt-val', res.osfiSwitch.monthlyPayment);
  money('switch-mo-save', res.osfiSwitch.monthlySavingsVsBank);
  money('switch-5yr-save', res.osfiSwitch.savings5Yr);

  // Prepayment
  money('prepay-pmt-val', res.prepayment.monthlyPayment);
  money('prepay-mo-save', res.prepayment.monthlySavingsVsStatusQuo);

  // Extension
  money('extend-pmt-val', res.amortExtension.monthlyPayment);
  money('extend-shock-val', res.amortExtension.monthlyPaymentShockDollars);
  money('extend-extra-interest', res.amortExtension.extraLifetimeInterest);

  updateChart(res.currentPayment, res.statusQuo.monthlyPayment, res.osfiSwitch.monthlyPayment, res.amortExtension.monthlyPayment);
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
    renewalBalance: Number(get('balance-input').value),
    remainingAmortYears: Number(get('amort-input').value),
    currentRate: Number(get('curr-rate-input').value) / 100,
    bankRenewalRate: Number(get('renew-rate-input').value) / 100,
    competitorRate: Number(get('switch-rate-input').value) / 100,
    lumpSumPrepayment: Number(get('prepay-input').value || 0),
    extendedAmortYears: Number(get('ext-amort-input').value)
  };

  try {
    const res = calcCanadianMortgageShock(inputs);
    render(res);
  } catch (err) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = err.message;
  }
}

function setExample(tier) {
  if (tier === 'typical') {
    get('balance-input').value = '450000';
    get('curr-rate-input').value = '2.19';
    get('renew-rate-input').value = '4.89';
    get('switch-rate-input').value = '4.59';
  } else {
    get('balance-input').value = '650000';
    get('curr-rate-input').value = '1.89';
    get('renew-rate-input').value = '5.09';
    get('switch-rate-input').value = '4.69';
  }
  update();
}

form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
get('example-typical').addEventListener('click', () => setExample('typical'));
get('example-gta').addEventListener('click', () => setExample('gta'));
update();
