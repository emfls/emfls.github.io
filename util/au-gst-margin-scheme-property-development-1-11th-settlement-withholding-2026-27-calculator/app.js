import { calculateGst } from './model.mjs';

const form = document.querySelector('#gst-form');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const eligibility = document.querySelector('#eligibility');
const acquisition = form.querySelector('#acquisition');
const agreement = form.querySelector('#agreement');
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
});
const money = (value) => value === null ? 'N/A' : currency.format(value);
const set = (id, value) => {
  document.getElementById(id).textContent = value;
};

function balance(value, positiveLabel, negativeLabel) {
  if (value === undefined) return 'N/A';
  if (Math.abs(value) < 0.005) return money(0);
  return `${money(Math.abs(value))} ${value > 0 ? positiveLabel : negativeLabel}`;
}

function showScenario(prefix, gst, scenario) {
  set(`${prefix}-gst`, money(gst));
  set(`${prefix}-rate`, money(scenario?.withholdingAtRate ?? null));
  set(`${prefix}-withholding`, money(scenario?.withholding ?? null));
  set(`${prefix}-proceeds`, money(scenario?.settlementProceeds ?? null));
  set(`${prefix}-sale-bas`, balance(scenario?.saleOnlyBasBalance, 'credit', 'top-up'));
  set(`${prefix}-combined-bas`, balance(scenario?.combinedBasBalance, 'refund', 'top-up'));
  set(`${prefix}-net`, balance(scenario?.netProjectGstCashFlow, 'inflow', 'outflow'));
}

function update() {
  let estimate;
  try {
    estimate = calculateGst({
      eligibleAcquisitionCostOrValuation: form.querySelector('#basis').valueAsNumber,
      lots: form.querySelector('#lots').valueAsNumber,
      salePricePerLot: form.querySelector('#sale').valueAsNumber,
      constructionCostsInclGst: form.querySelector('#costs').valueAsNumber,
      acquisitionStatus: acquisition.value,
      writtenAgreement: agreement.value,
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    if (error.textContent !== issue.message) error.textContent = issue.message;
    error.hidden = false;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  const reasons = [];
  if (acquisition.value === 'ineligible_full_gst_acquired') reasons.push('the acquisition was taxed in full');
  if (acquisition.value === 'unconfirmed') reasons.push('acquisition eligibility is unconfirmed');
  if (agreement.value === 'no') reasons.push('a written agreement by settlement is missing');
  eligibility.textContent = estimate.eligible
    ? 'Eligible on the stated inputs.'
    : `Margin scheme unavailable in this estimate because ${reasons.join(' and ')}.`;
  eligibility.classList.toggle('invalid', !estimate.eligible);

  set('gst-saved', money(estimate.directGstSaved));
  set('gross-sales', money(estimate.grossSalePrice));
  set('basis-per-lot', money(estimate.acquisitionBasisPerLot));
  set('margin', money(estimate.margin));
  set('construction-itc', money(estimate.constructionItc));
  showScenario('ms', estimate.marginSchemeGst, estimate.marginScheme);
  showScenario('std', estimate.standardFullGst, estimate.standard);
  results.hidden = false;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', update);
update();
