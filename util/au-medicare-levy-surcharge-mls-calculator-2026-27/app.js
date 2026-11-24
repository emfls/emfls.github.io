import { calculateMls } from './model.mjs';

const form = document.querySelector('#calculator');
const familyFields = document.querySelector('#family-fields');
const error = document.querySelector('#input-error');
const results = document.querySelector('#results');
const amounts = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });
const money = value => amounts.format(value);
const show = (id, value) => { document.getElementById(id).textContent = value; };

function update() {
  const status = form.elements.status.value;
  familyFields.hidden = status === 'single';
  familyFields.disabled = familyFields.hidden;
  const inputs = [...form.querySelectorAll('input')].filter(input => !input.matches(':disabled'));
  const invalid = inputs.find(input => !input.validity.valid);
  if (invalid) {
    results.hidden = true;
    error.textContent = `${invalid.labels[0].textContent} — ${invalid.validationMessage}`;
    return;
  }

  try {
    const values = Object.fromEntries(inputs.map(input => [input.name, input.value === '' ? 0 : input.valueAsNumber]));
    const estimate = calculateMls({ ...values, status });
    show('tier', `${estimate.tier === 0 ? 'Base tier' : `Tier ${estimate.tier}`} · ${percent.format(estimate.rate)}`);
    show('tier-income', money(estimate.tierIncome));
    show('surcharge-base', money(estimate.surchargeBase));
    show('child-bonus', money(estimate.childBonus));
    document.querySelector('#child-bonus-row').hidden = status === 'single';
    show('prorated-mls', money(estimate.proratedMls));
    show('standard-levy', money(estimate.standardLevy));
    show('full-year-mls', money(estimate.fullYearMls));
    show('break-even', money(estimate.breakEvenPremium));
    const { netSavings } = estimate;
    if (netSavings === 0) {
      show('net', 'Break-even — $0.00 difference');
    } else {
      show('net', netSavings > 0
        ? `Save ${money(netSavings)} a year with cover`
        : `Cover costs ${money(-netSavings)} more a year`);
    }
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();

// Initialise manual placements once slots from the configured publisher are supplied.
for (const ad of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
