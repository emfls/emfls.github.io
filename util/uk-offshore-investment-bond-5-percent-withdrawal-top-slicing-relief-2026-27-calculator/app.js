import { calculateBond } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('bond-form');
const results = byId('bond-results');
const error = byId('bond-error');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percentage = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const moneyFields = [
  'finalTax', 'availableAllowance', 'currentDeferred', 'gain', 'tar', 'taxableGain',
  'fullGainTax', 'relief', 'otherTaxImpact', 'additionalIncomeTax',
  'ani', 'fullPA', 'fullPSA', 'slice', 'slicePA', 'slicePSA', 'sliceTax'
];

function update() {
  const event = byId('event').value;
  const partial = event === 'withdrawal';
  const years = byId('policyYears');
  years.min = partial ? '1' : '0';
  byId('years-help').textContent = partial
    ? 'Enter the policy year ending on the excess event date. Use 1 for the first policy year.'
    : 'Enter complete years at surrender, using the certificate where available.';
  for (const [id, enabled] of [['surrender-fields', !partial], ['withdrawal-fields', partial]]) {
    const fields = byId(id);
    fields.hidden = !enabled;
    fields.disabled = !enabled;
  }

  const inputs = { event };
  for (const input of form.querySelectorAll('input:enabled')) {
    if (!input.validity.valid) {
      const label = input.labels[0].textContent;
      error.textContent = `${label}. ${input.validationMessage}`;
      results.hidden = true;
      return;
    }
    inputs[input.name] = input.valueAsNumber;
  }

  let estimate;
  try {
    estimate = calculateBond(inputs);
  } catch (issue) {
    error.textContent = issue.message;
    results.hidden = true;
    return;
  }

  error.textContent = '';
  for (const key of moneyFields) {
    byId(key).textContent = estimate[key] === null ? '' : gbp.format(estimate[key]);
  }
  byId('effectiveRate').textContent = estimate.taxableGain > 0
    ? percentage.format(estimate.effectiveRate) : '—';
  byId('n').textContent = estimate.n;
  byId('deferred-metric').hidden = !partial;
  byId('allowance-label').textContent = partial
    ? 'Available 5% withdrawal allowance before this year’s withdrawals'
    : 'Unused 5% withdrawal allowance before surrender';
  const loss = byId('surrender-note');
  loss.hidden = partial || estimate.surrenderResult >= 0;
  if (!loss.hidden) {
    const recordedGains = inputs.previousGains > 0 ? ' Check whether deficiency relief applies.' : '';
    loss.textContent = `The surrender calculation produces a negative amount of ${gbp.format(Math.abs(estimate.surrenderResult))}. There is no positive gain.${recordedGains}`;
  }

  byId('hicbc-alert').textContent = estimate.hicbc
    ? `${estimate.baseAni > 60000 ? 'Income was already above' : 'This gain takes income above'} £60,000. A Child Benefit charge may apply if you or your partner receive Child Benefit.`
    : 'Adjusted net income is within the £60,000 Child Benefit charge threshold.';
  byId('taper-alert').textContent = estimate.taper
    ? `${estimate.baseAni > 100000 ? 'Income was already above' : 'This gain takes income above'} £100,000. Your tax-year Personal Allowance is ${gbp.format(estimate.fullPA)}.`
    : 'Adjusted net income is within the £100,000 Personal Allowance taper threshold.';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('change', event => {
  if (event.target === byId('event')) update();
});
form.addEventListener('submit', event => event.preventDefault());
update();
