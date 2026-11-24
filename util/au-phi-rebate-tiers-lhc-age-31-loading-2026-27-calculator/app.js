import { calculate } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('calculator');
const results = get('results');
const error = get('error');
const household = get('household');
const children = get('children');
const hospital = get('hospital');
const partnerAge = get('join-age-2');
const partnerBaseDay = get('base-day-2');

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'code',
});
const money = value => aud.format(value);
const setText = (id, text) => { get(id).textContent = text; };

function update() {
  const isCouple = household.value === 'couple';
  const isFamily = household.value !== 'single';
  const isSingleParent = household.value === 'single-parent';
  const hasHospital = hospital.valueAsNumber > 0;

  get('children-field').hidden = !isFamily;
  children.disabled = !isFamily;
  if (isSingleParent && children.min === '0' && children.value === '0') {
    children.value = '1';
  }
  children.min = isSingleParent ? '1' : '0';
  setText('income-label', isCouple ? 'Combined income for surcharge purposes (A$)' : 'Income for surcharge purposes (A$)');

  get('partner-field').hidden = !isCouple;
  partnerAge.disabled = !isCouple;
  partnerBaseDay.disabled = !isCouple;
  const joiningFields = get('joining-fields');
  joiningFields.hidden = !hasHospital;
  joiningFields.disabled = !hasHospital;

  let estimate;
  try {
    estimate = calculate({
      household: household.value,
      dependentChildren: isFamily ? children.valueAsNumber : 0,
      income: get('income').valueAsNumber,
      oldestAge: get('oldest-age').valueAsNumber,
      joinAge1: get('join-age-1').valueAsNumber,
      joinAge2: partnerAge.valueAsNumber,
      byBaseDay1: get('base-day-1').checked,
      byBaseDay2: partnerBaseDay.checked,
      hospital: hospital.valueAsNumber,
      extras: get('extras').valueAsNumber,
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }

  error.hidden = true;
  const tierName = estimate.tier ? `Tier ${estimate.tier}` : 'Base tier';
  setText('net-annual', money(estimate.netAnnual));
  setText('net-monthly', money(estimate.netMonthly));
  setText('tier', `${tierName} · ${estimate.rebateRate.toFixed(3)}%`);
  setText('rebate', money(estimate.rebate));
  setText('loading', `${estimate.loadingRate}% · ${money(estimate.loadingCost)}`);
  setText('ten-year-loading', money(estimate.tenYearLoadingCost));
  setText('mls-without-cover', `${estimate.mlsRate}% · ${money(estimate.mlsWithoutCover)}`);
  setText('mls-avoided', money(estimate.mlsAvoided));
  setText('net-vs-mls', money(estimate.netVsMls));
  setText('loading-note', hasHospital
    ? `The rebate applies to eligible base premiums. The LHC loading receives no rebate and falls to ${estimate.postLoadingRate}% after 10 continuous years of hospital cover with loading.`
    : 'Extras-only cover carries no LHC loading and avoids no Medicare levy surcharge.');
  setText('mls-note', 'The MLS comparison assumes appropriate hospital cover for everyone in the household for a full year and no personal exemptions. It uses surcharge income to approximate the amount subject to MLS.');
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
