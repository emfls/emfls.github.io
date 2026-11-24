import { calculateCGT } from './model.mjs';

const form = document.querySelector('#cgt-form');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const relatedFields = document.querySelector('#rental-fields');
const comparison = document.querySelector('#comparison-values');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' });
const amountNodes = [...results.querySelectorAll('[data-amount]')];
const comparisonNodes = [...comparison.querySelectorAll('[data-comparison]')];
const dateLabel = date => dates.format(new Date(`${date}T00:00:00Z`));

function update() {
  const entity = form.elements.entity.value;
  const home = form.elements.homeMode;
  const resident = entity === 'resident';
  const homeField = document.querySelector('#home-field');
  homeField.hidden = !resident;
  home.disabled = !resident;
  const homeMode = resident ? home.value : 'none';
  relatedFields.hidden = homeMode !== 'rented';
  relatedFields.disabled = relatedFields.hidden;

  try {
    const fields = Object.fromEntries(new FormData(form));
    for (const input of form.querySelectorAll('input[type="number"]:enabled')) {
      if (!input.validity.valid) {
        throw new RangeError(`Check “${input.labels[0].textContent.trim()}”. Use an amount from A$0 to A$1 billion with up to two decimal places.`);
      }
      fields[input.name] = input.valueAsNumber;
    }
    const result = calculateCGT({ ...fields, homeMode, discountAllowed: form.elements.discountAllowed.checked });
    for (const node of amountNodes) node.textContent = currency.format(result[node.dataset.amount]);
    document.querySelector('#taxable-share').textContent = percent.format(result.taxableFraction);
    document.querySelector('#discount-rate').textContent = percent.format(result.discountRate);
    document.querySelector('#cost-base-note').textContent = result.useMarketValue
      ? 'This gain uses the market value at first income-producing use, plus eligible costs from that date.'
      : 'This gain uses the original purchase price and entered costs.';
    const canDiscount = entity !== 'foreign' && form.elements.discountAllowed.checked && result.taxableFraction > 0;
    document.querySelector('#holding-note').textContent = canDiscount
      ? `Earliest eligible CGT event date under the holding test is ${dateLabel(result.eligibleFrom)}.`
      : 'The selected scenario has no applicable holding-period discount.';
    comparison.hidden = !result.comparison;
    if (result.comparison) {
      for (const node of comparisonNodes) node.textContent = currency.format(result.comparison[node.dataset.comparison]);
    }
    document.querySelector('#comparison-note').textContent = result.comparison
      ? 'Both estimates use the same 2026–27 income, sale price, costs and losses to isolate the holding-period effect.'
      : homeMode !== 'none'
        ? 'This comparison applies to standard sales. A later former-home sale can also change the exempt share.'
        : 'The holding period would first qualify after 30 June 2027. See the reform alert below.';
    results.hidden = false;
    error.textContent = '';
  } catch (issue) {
    results.hidden = true;
    error.textContent = issue.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
