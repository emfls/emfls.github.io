import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator-form');
const resultSection = byId('estimate');
const errorMessage = byId('input-error');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'code' });
const signedCurrency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'code', signDisplay: 'exceptZero' });
const money = value => value == null ? 'Unavailable' : currency.format(value);
const difference = value => value == null ? 'Unavailable' : signedCurrency.format(value);
const put = (id, value) => { byId(id).textContent = value; };
const value = name => form.elements.namedItem(name).value;
const number = name => form.elements.namedItem(name).valueAsNumber;

function toggleField(fieldId, inputId, visible) {
  byId(fieldId).hidden = !visible;
  byId(inputId).disabled = !visible;
}

function renderResult(result, arrangement, transfer) {
  const {
    factor, factorAge, reasonablenessLimit, entryContribution, giftExcess, giftAllowance, deprivedAsset,
    standardGiftDeprivedAsset, homeowner, assessableInterest, pensionEligibleByAge, grannyPension, standardGiftPension,
    annualDifference, fiveYearDifference, annualDeprivationImpact, fiveYearDeprivationImpact,
  } = result;

  const notes = [];
  if (arrangement === 'standardCost') notes.push('The example assumes the documented transfer qualifies at its actual cost or value.');
  if (arrangement === 'unknown') notes.push('Confirm the lifetime right with Services Australia before estimating the granny flat treatment.');
  if (reasonablenessLimit !== null) notes.push(`The combined annual partnered rate is multiplied by ${factor.toFixed(2)} for age ${factorAge} at next birthday.`);
  if (factor === null && (arrangement === 'lumpSum' || arrangement === 'documentedPlusExtra')) {
    notes.push('The applicable age is outside the published DSS schedule of 51–100 at next birthday.');
  }
  if (transfer === 0) notes.push('Enter a positive transfer to estimate entry contribution status.');
  if (!pensionEligibleByAge) notes.push('The selected recipients must be at least 67 for the current pension comparison.');
  put('assessment-note', notes.join(' '));
  put('test-result', arrangement === 'standardCost' ? 'Not applied' : money(reasonablenessLimit));
  put('deprived-result', money(deprivedAsset));
  put('housing-result', homeowner === null ? 'Unavailable' : homeowner ? 'Homeowner' : 'Non-homeowner');
  put('annual-result', difference(annualDifference));
  put('five-year-result', difference(fiveYearDifference));
  put('loss-result', annualDeprivationImpact === null
    ? 'Unavailable'
    : `${money(annualDeprivationImpact)} / yr · ${money(fiveYearDeprivationImpact)} over 5 years`);

  put('entry-row', money(entryContribution));
  put('excess-row', money(giftExcess));
  put('gift-row', money(transfer));
  put('allowance-right', money(giftAllowance));
  put('allowance-gift', money(giftAllowance));
  put('deprived-right', money(deprivedAsset));
  put('deprived-gift', money(standardGiftDeprivedAsset));
  put('interest-row', money(assessableInterest));

  for (const [column, pension] of [['right', grannyPension], ['gift', standardGiftPension]]) {
    put(`assets-${column}`, money(pension?.assets));
    put(`threshold-${column}`, money(pension?.threshold));
    put(`deem-${column}`, money(pension?.deemedAnnual));
    put(`pension-${column}`, money(pension?.annual));
    put(`binding-${column}`, pension?.bindingTest ?? 'Unavailable');
  }
}

function update() {
  const household = value('household');
  const arrangement = value('arrangement');
  toggleField('partner-field', 'partnerNextBirthdayAge', household !== 'single');
  toggleField('cost-field', 'documentedCost', arrangement === 'documentedPlusExtra');

  const invalidField = Array.from(form.elements).find(field => field.willValidate && !field.validity.valid);
  if (invalidField) {
    showError(`${invalidField.labels[0].textContent}. ${invalidField.validationMessage}`);
    return;
  }

  const transfer = number('transfer');
  try {
    const result = calculate({
      household, arrangement, transfer,
      nextBirthdayAge: number('nextBirthdayAge'),
      partnerNextBirthdayAge: number('partnerNextBirthdayAge'),
      documentedCost: number('documentedCost'),
      giftsThisYear: number('giftsThisYear'),
      fiveYearAllowanceUsed: number('fiveYearAllowanceUsed'),
      otherAssets: number('otherAssets'),
      financialAssets: number('financialAssets'),
      otherAnnualIncome: number('otherAnnualIncome'),
      giftHomeowner: value('giftHomeowner') === 'true',
      annualPartneredRate: number('annualPartneredRate'),
      eaa: number('eaa'),
    });
    renderResult(result, arrangement, transfer);
    errorMessage.hidden = true;
    resultSection.hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError(error.message);
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  resultSection.hidden = true;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('reset', () => queueMicrotask(update));
update();
