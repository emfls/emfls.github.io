import { compare } from './model.mjs';

const form = document.getElementById('ir35-form');
const outputs = document.getElementById('outputs');
const errors = document.getElementById('input-error');
const fundingNote = document.getElementById('funding-note');
const status = document.getElementById('results-status');
const margin = form.elements.namedItem('margin');
const periods = form.elements.namedItem('marginPeriods');
const frequency = form.elements.namedItem('marginFrequency');
const marginLabel = document.getElementById('margin-label');
const periodsLabel = document.getElementById('periods-label');
const numericFields = Array.from(form.querySelectorAll('input[type="number"]'));
const resultFields = Array.from(outputs.querySelectorAll('[data-value]'));

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const signedGbp = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', signDisplay: 'exceptZero'
});
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const signedPercent = new Intl.NumberFormat('en-GB', {
  style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero'
});

function displayValue(path, comparison) {
  const [group, key] = path.split('.');
  const value = key ? comparison[group][key] : comparison[group];
  if (value === null) return '—';
  if (key === 'retention') return percent.format(value);
  if (group === 'uplift') return signedPercent.format(value);
  if (group === 'annualGap' || group === 'dailyGap') return signedGbp.format(value);
  return gbp.format(value);
}

function update() {
  const monthly = frequency.value === 'monthly';
  marginLabel.textContent = monthly ? 'Monthly umbrella margin (£)' : 'Weekly umbrella margin (£)';
  periodsLabel.textContent = monthly ? 'Months charged per year' : 'Weeks charged per year';
  periods.max = monthly ? '12' : '53';

  let firstInvalid;
  const assumptions = {};
  for (const field of numericFields) {
    assumptions[field.name] = field.valueAsNumber;
    if (field.validity.valid) {
      field.removeAttribute('aria-invalid');
    } else {
      field.setAttribute('aria-invalid', 'true');
      firstInvalid ??= field;
    }
  }
  if (firstInvalid) {
    outputs.hidden = true;
    errors.hidden = false;
    errors.textContent = firstInvalid.labels[0].textContent + '. ' + firstInvalid.validationMessage;
    return;
  }

  assumptions.levyApplies = form.elements.namedItem('levyApplies').checked;
  assumptions.employmentAllowance = form.elements.namedItem('employmentAllowance').checked;
  assumptions.dividendMode = form.elements.namedItem('dividendMode').value;
  const comparison = compare(assumptions);
  for (const field of resultFields) {
    field.textContent = displayValue(field.dataset.value, comparison);
  }

  const warnings = [];
  if (comparison.inside.shortfall > 0) {
    warnings.push('The umbrella assignment pot falls short of the entered margin and pension by '
      + gbp.format(comparison.inside.shortfall) + '.');
  }
  if (comparison.outside.shortfall > 0) {
    warnings.push('The company needs ' + gbp.format(comparison.outside.shortfall)
      + ' in other funding to pay the entered costs and salary. The salary estimate assumes that funding is available.');
  } else if (comparison.matchRate === null) {
    warnings.push('A matching day rate is unavailable because the limited company cash target is zero.');
  }
  fundingNote.textContent = warnings.join(' ');
  fundingNote.hidden = warnings.length === 0;
  errors.hidden = true;
  outputs.hidden = false;
  status.textContent = 'Inside take-home ' + gbp.format(comparison.inside.net)
    + '. Outside take-home ' + gbp.format(comparison.outside.net) + '. '
    + (comparison.matchRate === null
      ? 'Matching day rate unavailable.'
      : 'Matching day rate ' + gbp.format(comparison.matchRate) + '.');
}

const marginSettings = {
  weekly: { amount: margin.defaultValue, count: periods.defaultValue },
  monthly: { amount: '100', count: '12' }
};
let activeFrequency = frequency.value;
frequency.addEventListener('change', () => {
  marginSettings[activeFrequency] = { amount: margin.value, count: periods.value };
  activeFrequency = frequency.value;
  const settings = marginSettings[activeFrequency];
  margin.value = settings.amount;
  periods.value = settings.count;
  update();
});
form.addEventListener('input', (event) => {
  if (event.target !== frequency) update();
});
form.addEventListener('submit', (event) => event.preventDefault());
update();
