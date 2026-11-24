import { calculateTransferTax, isFamilyRelationship } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('transfer-form');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 });
const formatRate = value => percent.format(value) + '%';
const municipalityInput = get('municipality');
const clrInput = get('clr-factor');
const shareInput = get('buyer-share');
const relationshipInput = get('relationship');
const exemptionInput = get('confirmed-exemption');

function update() {
  const buyerShare = shareInput.valueAsNumber;
  const valuation = get('valuation').value;
  const relationship = relationshipInput.value;
  const family = isFamilyRelationship(relationship);
  const confirmedExemption = family && exemptionInput.checked;

  get('buyer-share-label').textContent = formatRate(buyerShare);
  shareInput.setAttribute('aria-valuetext', buyerShare + '% buyer, ' + (100 - buyerShare) + '% seller');
  get('exemption-check').hidden = !family;
  get('consideration-field').hidden = confirmedExemption || valuation === 'computed';
  get('assessment-fields').hidden = confirmedExemption || valuation === 'sale';

  let result;
  try {
    result = calculateTransferTax({
      municipality: municipalityInput.value,
      consideration: get('consideration').valueAsNumber,
      buyerShare,
      valuation,
      assessment: get('assessment').valueAsNumber,
      clrFactor: clrInput.valueAsNumber,
      relationship,
      confirmedExemption,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    get('input-error').textContent = error.message;
    get('results').hidden = true;
    get('builder-estimate').hidden = true;
    return;
  }

  get('input-error').textContent = '';
  get('results').hidden = false;
  get('builder-estimate').hidden = false;
  for (const key of [
    'taxableBase', 'localTax', 'stateTax', 'totalTax', 'buyerTax', 'sellerTax',
    'philadelphiaPremium', 'buyerPremium', 'fullBuyerIncrease',
  ]) {
    get(key).textContent = currency.format(result[key]);
  }
  for (const key of ['localRate', 'stateRate', 'totalRate', 'buyerRate', 'sellerRate']) {
    get(key).textContent = formatRate(result[key]);
  }

  get('valuation-result').textContent = result.exempt
    ? 'Confirmed family exemption assumed for both local and state tax.'
    : result.computedValue === null
      ? 'Based on actual consideration.'
      : 'CLR-adjusted value ' + currency.format(result.computedValue)
        + (valuation === 'floor' ? ' in the higher-of planning scenario.' : '.');
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === municipalityInput) {
    clrInput.value = municipalityInput.selectedOptions[0].dataset.clrFactor ?? '';
  }
  if (event.target === relationshipInput || event.target === municipalityInput) {
    exemptionInput.checked = false;
  }
  update();
});

for (const button of form.querySelectorAll('[data-buyer-share]')) {
  button.addEventListener('click', () => {
    shareInput.value = button.dataset.buyerShare;
    update();
  });
}

update();
