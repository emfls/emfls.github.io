import { calculateIht } from './model.mjs';

const form = document.getElementById('iht-form');
const estimate = document.getElementById('estimate');
const error = document.getElementById('error');
const note = document.getElementById('result-note');
const giftRate = document.getElementById('gift-rate');
const residenceFields = document.getElementById('residence-fields');
const resultAmounts = estimate.querySelectorAll('[data-money]');
const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const percentage = new Intl.NumberFormat('en-GB', { style: 'percent' });

function field(id) {
  return form.elements.namedItem(id);
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
  estimate.hidden = true;
}

function update() {
  const useResidence = field('useResidence').checked;
  const home = field('residenceValue');
  const taperEstate = field('taperEstateValue');
  residenceFields.hidden = !useResidence;
  home.disabled = taperEstate.disabled = !useResidence;

  const invalid = form.querySelector('input:invalid, select:invalid');
  if (invalid) {
    showError(invalid.labels[0].textContent + '. ' + invalid.validationMessage);
    return;
  }

  const years = field('yearsSurvived').valueAsNumber;
  let result;
  try {
    result = calculateIht({
      priorGifts: field('priorGifts').valueAsNumber,
      giftValue: field('giftValue').valueAsNumber,
      annualExemption: field('annualExemption').valueAsNumber,
      weddingExemption: Number(field('weddingExemption').value),
      yearsSurvived: years,
      estateValue: field('estateValue').valueAsNumber,
      outOfIncome: field('outOfIncome').checked,
      transferredNrbPercent: field('transferredNrbPercent').valueAsNumber,
      residenceValue: useResidence ? home.valueAsNumber : 0,
      taperEstateValue: useResidence && taperEstate.value !== '' ? taperEstate.valueAsNumber : undefined,
    });
  } catch (invalidInput) {
    if (!(invalidInput instanceof RangeError)) throw invalidInput;
    showError(invalidInput.message);
    return;
  }

  for (const amount of resultAmounts) {
    amount.textContent = gbp.format(result[amount.dataset.money]);
  }
  giftRate.textContent = result.excessOverNrb > 0 ? percentage.format(result.taperRate) : 'No taxable excess';
  if (years >= 7) {
    note.textContent = 'The current gift and all earlier outright gifts entered are outside the seven-year window.';
  } else if (result.netChargeableGift === 0) {
    note.textContent = 'Immediate exemptions cover the current gift in full.';
  } else if (result.excessOverNrb === 0) {
    note.textContent = 'The available band covers the current gift. Taper relief saves £0 and the gift uses '
      + gbp.format(result.nrbUsedByThisGift) + ' of the band that could otherwise cover the estate.';
  } else {
    note.textContent = 'The recipient’s estimate applies the ' + percentage.format(result.taperRate)
      + ' rate to ' + gbp.format(result.excessOverNrb) + ' above the available band.';
  }

  error.hidden = true;
  estimate.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
update();
