import { calculateCgt } from './model.mjs';

const form = document.getElementById('cgt-form');
const fields = form.elements;
const results = document.getElementById('cgt-results');
const error = document.getElementById('cgt-error');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const integer = new Intl.NumberFormat('en-AU');
const display = (id, value) => { document.getElementById(id).textContent = value; };

function render() {
  const resident = fields.resident.value === 'resident';
  const history = fields.history.value;
  const mainResidence = resident && history !== 'investment';
  const laterRental = mainResidence && fields.laterRentalDays.valueAsNumber > 0;
  const marketReset = laterRental && history === 'home-first' && fields.useMarketReset.checked;

  document.getElementById('residence-fields').hidden = !mainResidence;
  document.getElementById('initial-rental').hidden = history !== 'rental-first';
  document.getElementById('later-rental').hidden = !laterRental;
  document.getElementById('reset-choice').hidden = !laterRental || history !== 'home-first';
  document.getElementById('reset-fields').hidden = !marketReset;
  document.getElementById('medicare-choice').hidden = !resident;
  document.getElementById('foreign-warning').hidden = resident;

  const input = Object.fromEntries(new FormData(form));
  for (const field of form.querySelectorAll('input[type="number"]')) {
    input[field.name] = field.valueAsNumber;
  }
  Object.assign(input, {
    resident, useMarketReset: marketReset,
    electAbsence: fields.electAbsence.checked,
    includeMedicare: fields.includeMedicare.checked,
  });

  try {
    const estimate = calculateCgt(input);
    for (const key of [
      'marginalCgtBill', 'combinedTaxSaved', 'costBase', 'grossGain', 'apportionedGain',
      'lossesUsed', 'gainAfterLosses', 'netTaxableCgt', 'capitalLoss', 'lossesRemaining',
      'noConcessionsBill', 'absenceTaxSaved', 'discountTaxSaved',
    ]) {
      display(key, estimate[key] === null ? 'Valuation needed' : money.format(estimate[key]));
    }
    display('apportionment', `${integer.format(estimate.nonExemptDays)} / ${integer.format(estimate.ownershipDays)} days`);
    display('protectedRentalDays', integer.format(estimate.protectedRentalDays));
    display('discountRate', `${estimate.discountRate * 100}%`);
    display('basis', estimate.useReset ? 'First-rental market value basis' : 'Original purchase basis');
    results.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (problem) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
