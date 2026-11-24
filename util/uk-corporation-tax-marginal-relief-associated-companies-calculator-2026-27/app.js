import { calculateScenario } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('tax-form');
const inputs = Array.from(form.querySelectorAll('input[type="number"]'));
const results = byId('tax-results');
const error = byId('tax-error');
const cashCost = byId('cash-cost');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const bandLabels = { small: 'Small profits', marginal: 'Marginal Relief', main: 'Main rate' };
const percentOrDash = (rate) => rate === null ? '—' : percent.format(rate);
const comparison = (before, after) => `${before} → ${after}`;

function set(id, value) {
  byId(id).textContent = value;
}

function render() {
  const values = {};
  let firstInvalid;
  for (const input of inputs) {
    if (!input.validity.valid) {
      input.setAttribute('aria-invalid', 'true');
      firstInvalid ??= input;
    } else {
      input.removeAttribute('aria-invalid');
      values[input.id] = input.value === '' ? undefined : input.valueAsNumber;
    }
  }

  if (firstInvalid) {
    error.textContent = `${firstInvalid.labels[0].textContent}. ${firstInvalid.validationMessage}`;
    results.hidden = true;
    cashCost.textContent = '';
    return;
  }

  const { before, after, steps, totalSaved, aiaAvailable, aiaExcess, cashCost: netCost } = calculateScenario(values);
  error.textContent = '';
  set('before-tax', gbp.format(before.tax));
  set('after-tax', gbp.format(after.tax));
  set('total-saved', gbp.format(totalSaved));
  set('lower-limit', gbp.format(before.lowerLimit));
  set('upper-limit', gbp.format(before.upperLimit));
  set('taxable-profits', comparison(gbp.format(before.taxableProfits), gbp.format(after.taxableProfits)));
  set('augmented-profits', comparison(gbp.format(before.augmentedProfits), gbp.format(after.augmentedProfits)));
  set('tax-band', comparison(bandLabels[before.band], bandLabels[after.band]));
  set('effective-rate', comparison(percentOrDash(before.effectiveRate), percentOrDash(after.effectiveRate)));
  set('marginal-relief', comparison(gbp.format(before.relief), gbp.format(after.relief)));
  set('aia-limit', gbp.format(aiaAvailable));

  for (const step of steps) {
    const row = byId(step.id === 'pension' ? 'pension-step' : step.id);
    row.querySelector('small').textContent = `${gbp.format(step.deduction)} claimed`;
    row.cells[1].textContent = gbp.format(step.saved);
    row.cells[2].textContent = percentOrDash(step.savingsRate);
  }

  set('aia-excess', aiaExcess > 0
    ? `${gbp.format(aiaExcess)} of entered expenditure exceeds the available AIA. Other capital allowances may apply.`
    : '');
  set('loss-note', after.taxableProfits === 0
    ? 'There are no taxable profits left in this estimate. Any relief for losses falls outside this calculation.'
    : '');
  cashCost.textContent = `Your entered spending and contributions use ${gbp.format(netCost)} of company cash after the estimated tax saving.`;
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
render();

for (const ad of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(ad.dataset.adSlot)) {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
}
