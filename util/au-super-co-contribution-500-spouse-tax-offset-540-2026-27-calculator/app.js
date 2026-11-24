import { calculate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('super-form');
const numericInputs = [...form.querySelectorAll('input[type="number"]')];
const conditions = [...form.querySelectorAll('input[type="checkbox"]')];
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol'
});
const percent = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const money = (value) => currency.format(value).replace('$', 'A$');

function showError(message) {
  byId('input-error').textContent = message;
  byId('combined').textContent = '—';
  byId('results').hidden = true;
  byId('opportunity').hidden = true;
}

function render() {
  const invalid = numericInputs.filter((input) => !input.validity.valid || Math.abs(input.valueAsNumber) > 1e12);
  numericInputs.forEach((input) => input.setAttribute('aria-invalid', String(invalid.includes(input))));
  if (invalid.length) {
    showError(`Check this field: ${invalid[0].labels[0].textContent}.`);
    return;
  }

  const entries = numericInputs.map(({ id, valueAsNumber }) => [id, valueAsNumber]);
  entries.push(...conditions.map(({ id, checked }) => [id, checked]));
  const result = calculate(Object.fromEntries(entries));
  const moneyFields = [
    'combined', 'coPayment', 'spouseOffset', 'usableOffset', 'personalTarget',
    'spouseTarget', 'coFutureValue', 'combinedFutureValue'
  ];
  for (const id of moneyFields) byId(id).textContent = money(result[id]);
  for (const id of ['personalRatio', 'spouseRatio', 'combinedRatio']) {
    byId(id).textContent = result[id] === null ? '—' : `${percent.format(result[id])}%`;
  }

  byId('personal-status').textContent = result.personalReasons.length
    ? `Co-contribution eligibility: ${result.personalReasons.join('. ')}.` : '';
  byId('spouse-status').textContent = result.spouseReasons.length
    ? `Spouse offset eligibility: ${result.spouseReasons.join('. ')}.` : '';
  byId('target-note').textContent = result.personalTarget
    && result.personalTarget < result.personalIncomeTarget
    ? 'Your remaining cap room limits the personal contribution target.' : '';
  if (result.spouseTarget && result.spouseTarget < result.eligibleCap) {
    byId('target-note').textContent += ' Your spouse’s remaining cap room limits the spouse contribution target.';
  }

  const opportunity = byId('opportunity');
  opportunity.hidden = result.potentialIncrease < 0.005;
  opportunity.textContent = opportunity.hidden ? ''
    : `Using the contribution targets could increase your estimated household benefit by ${money(result.potentialIncrease)}.`;
  byId('input-error').textContent = '';
  byId('results').hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
