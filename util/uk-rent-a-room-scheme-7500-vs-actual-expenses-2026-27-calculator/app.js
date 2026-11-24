import { calculateRentARoom } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('calculator');
const error = get('input-error');
const results = get('results');
const pending = get('pending-results');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const recommendations = {
  exempt: 'Use the automatic exemption.',
  'consider-loss-election': 'Consider opting out to record the property loss.',
  actual: 'Use actual expenses (Method A). If you previously elected Method B, withdraw that election.',
  allowance: 'Elect or keep the flat allowance (Method B).',
  tie: 'Both methods give the same estimated tax. Method A applies by default above the limit.'
};

function renderMethod(prefix, method) {
  get(`${prefix}-profit`).textContent = gbp.format(method.taxableProfit);
  get(`${prefix}-tax`).textContent = gbp.format(method.tax);
  get(`${prefix}-loss`).textContent = gbp.format(method.loss);
  get(`${prefix}-annual`).textContent = gbp.format(method.annualCash);
  get(`${prefix}-monthly`).textContent = gbp.format(method.monthlyCash);
}

function update() {
  let result;
  try {
    result = calculateRentARoom({
      ownership: get('ownership').value,
      monthlyRent: get('monthly-rent').valueAsNumber,
      monthlyExtras: get('monthly-extras').valueAsNumber,
      months: get('months').valueAsNumber,
      expenses: get('expenses').valueAsNumber,
      taxRate: Number(get('tax-rate').value)
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    pending.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  pending.hidden = true;
  get('gross-receipts').textContent = gbp.format(result.grossReceipts);
  get('allowance').textContent = gbp.format(result.allowance);
  get('recommendation').textContent = recommendations[result.recommendation];
  get('tax-saved').textContent = gbp.format(result.annualTaxSaved);
  get('filing').textContent = result.filingRequired ? 'YES' : 'NO';
  get('filing-note').textContent = result.filingRequired
    ? 'Gross receipts exceed your limit. Report the room income even if your estimated tax is £0.'
    : 'No return is needed for this income alone under automatic exemption. Other filing duties still apply. Tell HMRC if you elect out to claim a loss.';
  get('allowance-heading').textContent = result.automaticallyExempt
    ? 'Automatic exemption'
    : 'Flat allowance (HMRC Method B)';
  renderMethod('allowance', result.allowanceMethod);
  renderMethod('actual', result.actual);
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
