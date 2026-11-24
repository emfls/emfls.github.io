import { compareFirstHome, states } from './model.mjs';

const form = document.getElementById('calculator');
const results = document.getElementById('results');
const status = document.getElementById('input-status');
const fields = form.elements;
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

function render() {
  const { state, property, price, grantValue, dutyEligible, grantEligible } = fields;
  const build = property.value === 'build';
  const showGrantValue = grantEligible.checked && (build || property.value === 'new');
  document.getElementById('grant-value-field').hidden = !showGrantValue;
  grantValue.disabled = !showGrantValue;
  grantValue.required = showGrantValue && build;
  document.getElementById('grant-value-label').textContent = build
    ? 'Land and build total (A$)'
    : 'Grant assessment value (A$, optional)';
  document.getElementById('grant-value-hint').textContent = build
    ? 'Include the land, construction and contract variations.'
    : 'Use the relevant purchase price or assessed value. Leave blank to use the dutiable value.';
  document.getElementById('price-label').textContent = build || property.value === 'land'
    ? 'Dutiable land value (A$)'
    : 'Dutiable property value (A$)';

  const value = price.valueAsNumber;
  const assessedGrantValue = showGrantValue && grantValue.value !== ''
    ? grantValue.valueAsNumber : undefined;
  const valid = price.validity.valid && grantValue.validity.valid;
  const invalidBuildTotal = build && showGrantValue && assessedGrantValue < value;
  status.textContent = invalidBuildTotal
    ? 'Enter a land and build total at least as high as the land value.'
    : valid ? '' : 'Enter valid dollar amounts with up to two decimal places.';
  status.hidden = valid && !invalidBuildTotal;
  results.hidden = !status.hidden;
  if (results.hidden) return;

  const comparison = compareFirstHome({
    value,
    property: property.value,
    grantValue: assessedGrantValue,
    dutyEligible: dutyEligible.checked,
    grantEligible: grantEligible.checked,
  });

  const selected = state.value;
  document.getElementById('selected-state').textContent = states[selected];
  for (const output of results.querySelectorAll('[data-metric]')) {
    const record = comparison[output.dataset.state || selected];
    output.textContent = currency.format(record[output.dataset.metric]);
  }
  for (const cell of results.querySelectorAll('.comparison [data-state]')) {
    cell.classList.toggle('selected', cell.dataset.state === selected);
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
