import { calculate } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#form-error');
const status = document.querySelector('#rescue-status');
const fields = form.elements;
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const integer = new Intl.NumberFormat('en-GB');
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const resultCells = results.querySelectorAll('[data-value]');
const display = (value, format) => value == null ? '—' : format.format(value);

function render() {
  try {
    const inputs = {};
    for (const field of fields) {
      if (!field.name) continue;
      if (field.type === 'number' && !field.validity.valid) {
        throw new RangeError(`Check ${field.labels[0].textContent.trim()}. Enter a number within the stated limits.`);
      }
      inputs[field.name] = field.type === 'number' ? field.valueAsNumber
        : field.type === 'checkbox' ? field.checked : field.value;
    }
    if (fields.oneDisabled.checked) inputs.disabledTfc += 1;
    const model = calculate(inputs);
    const values = { ...model, currentANI: model.before.ani };
    for (const cell of resultCells) {
      const scenario = cell.dataset.scenario;
      const value = (scenario ? values[scenario] : values)?.[cell.dataset.value];
      cell.textContent = cell.dataset.format === 'percent' ? display(value == null ? null : value / 100, percent)
        : display(value, cell.dataset.format === 'integer' ? integer : gbp);
    }

    const messages = [];
    if (!model.after) {
      messages.push('Salary and bonus alone cannot fund the required sacrifice.');
    } else if (!model.buffered) {
      messages.push('Salary and bonus can reach the £100,000 cap. The £99,999 buffer exceeds available pay.');
    }
    if (model.before.ani > 100_000 && !inputs.otherEligible) {
      messages.push('This sacrifice cannot restore the offers while the other parent remains above the cap.');
    }
    if (model.required === 0) messages.push('Your adjusted net income already meets the £100,000 income test.');
    if (model.after && inputs.pension + model.after.pensionAdded > 60_000) {
      messages.push('The entered and additional pension amounts exceed the standard £60,000 annual allowance before any separate employer payments or carry-forward.');
    }
    status.textContent = messages.join(' ');
    error.hidden = true;
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.textContent = issue.message;
    error.hidden = false;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();

// Manual display ads require slot IDs issued for this publisher account.
for (const ad of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
