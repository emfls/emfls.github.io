import { calculateCda } from './model.mjs';

const form = document.getElementById('cda-form');
const error = document.getElementById('error');
const estimate = document.getElementById('estimate');
const penaltyBox = document.getElementById('penalty-box');
const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3
});

function show(id, text) {
  const element = document.getElementById(id);
  if (element.textContent !== text) element.textContent = text;
}

function update() {
  let result;
  try {
    result = calculateCda(Object.fromEntries(new FormData(form)));
  } catch (cause) {
    estimate.hidden = true;
    error.hidden = false;
    show('error', cause.message);
    return;
  }

  const money = amount => currency.format(amount);
  const excessive = result.status === 'EXCESS_PENALTY';
  show('cda-balance', money(result.availableCdaBalance));
  show('safe-maximum', money(result.safeMaximum));
  show('non-eligible-saving', money(result.personalTaxSavedNonEligible));
  show('eligible-saving', money(result.personalTaxSavedEligible));
  show('comparison-detail', `Comparison on ${money(result.comparisonCash)} cash at ${result.nonEligibleRate.toFixed(2)}% non-eligible and ${result.eligibleRate.toFixed(2)}% eligible. The comparison excludes corporate tax and interest.`);
  penaltyBox.dataset.risk = result.status;
  show('part-iii-tax', money(result.partIIITax));
  show('risk-status', result.status);
  show('risk-detail', excessive
    ? `Your plan exceeds the modeled CDA by ${money(result.excess)}. Confirm the balance and reduce the elected dividend before filing.`
    : 'Your planned election is within the modeled CDA. Verify the balance and payable date before filing.');
  show('timing-detail', `The additional losses would reduce available CDA by ${money(result.timingRoomLost)} to ${money(result.projectedCdaBalance)} if realized before the dividend becomes payable.`);
  show('timing-excess', result.projectedElectionExcess > 0
    ? `In that case the planned election would exceed the balance by ${money(result.projectedElectionExcess)}.`
    : 'The planned election fits within the projected balance.');
  error.hidden = true;
  estimate.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
