import { compareRecastOptions } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('recast-form');
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

function updateChart(recastSave, curtailSave, refiSave) {
  show('chart-caption', 'Lifetime interest saved comparison');
  show('chart-desc', `Recast saves ${dollars.format(recastSave)}, Curtailment saves ${dollars.format(curtailSave)}, Refinance saves ${dollars.format(refiSave)}.`);
  const scale = Math.max(recastSave, curtailSave, Math.abs(refiSave), 1);
  const barRecast = get('bar-recast');
  const barCurtail = get('bar-curtail');
  if (barRecast) barRecast.setAttribute('width', String(Math.max(4, 380 * (recastSave / scale))));
  if (barCurtail) barCurtail.setAttribute('width', String(Math.max(4, 380 * (curtailSave / scale))));
  money('bar-val-recast', recastSave);
  money('bar-val-curtail', curtailSave);
}

function render(res) {
  money('primary-value', res.recast.totalMonthlySavings);
  money('secondary-value', res.recast.lifetimeInterestSaved);
  show('live-summary', `Mortgage recast lowers monthly payment by ${dollars.format(res.recast.totalMonthlySavings)}/mo (P&I savings ${dollars.format(res.recast.monthlyPiSavings)} + PMI savings ${dollars.format(res.recast.monthlyPmiSavings)}). Recast fee payback: ${res.recast.paybackMonths.toFixed(1)} months. Lifetime interest saved: ${dollars.format(res.recast.lifetimeInterestSaved)}.`);

  // Recast
  money('recast-new-bal', res.recast.newPrincipal);
  show('recast-new-ltv', `${res.recast.newLtv.toFixed(1)}%`);
  show('recast-pmi-status', res.recast.pmiRemoved ? 'Eliminated ($0/mo)' : `Active (${dollars.format(res.monthlyPmi)}/mo)`);
  money('recast-monthly-pmt', res.recast.totalMonthly);
  money('recast-monthly-save', res.recast.totalMonthlySavings);
  money('recast-interest-save', res.recast.lifetimeInterestSaved);
  show('recast-payback', `${res.recast.paybackMonths.toFixed(1)} months`);

  // Curtailment
  money('curtail-monthly-pmt', res.curtailment.monthlyPayment);
  show('curtail-term-shortened', `${res.curtailment.monthsShavedOff} months (${(res.curtailment.monthsShavedOff / 12).toFixed(1)} yrs)`);
  money('curtail-interest-save', res.curtailment.lifetimeInterestSaved);

  // Refinance
  money('refi-monthly-pmt', res.refinance.totalMonthly);
  money('refi-monthly-save', res.refinance.monthlySavings);
  money('refi-interest-paid', res.refinance.totalInterest);

  updateChart(res.recast.lifetimeInterestSaved, res.curtailment.lifetimeInterestSaved, 0);
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
    currentBalance: Number(get('loan-balance').value),
    homeValue: Number(get('home-value').value),
    noteRate: Number(get('loan-rate').value) / 100,
    remainingMonths: Number(get('loan-months').value),
    lumpSum: Number(get('lump-sum').value),
    monthlyPmi: Number(get('monthly-pmi').value || 0),
    recastFee: Number(get('recast-fee').value || 300),
    refiRate: Number(get('refi-rate').value) / 100,
    refiCosts: Number(get('refi-costs').value || 5000),
    refiTermMonths: Number(get('refi-term').value)
  };

  try {
    const res = compareRecastOptions(inputs);
    render(res);
  } catch (err) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = err.message;
  }
}

function setPreset(lump) {
  get('lump-sum').value = String(lump);
  update();
}

form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
get('preset-25k').addEventListener('click', () => setPreset(25000));
get('preset-50k').addEventListener('click', () => setPreset(50000));
update();
