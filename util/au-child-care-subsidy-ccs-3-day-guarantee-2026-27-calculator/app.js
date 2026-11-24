import { calculateCCS } from './model.mjs';

const form = document.getElementById('ccs-calculator');
const results = document.getElementById('ccs-results');
const status = document.getElementById('ccs-status');
const error = document.getElementById('ccs-error');
const { ati, careType, dailyFee, sessionHours, daysPerWeek, children,
  youngChildren, hoursTier, withholding } = form.elements;

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const hours = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const money = value => 'A' + aud.format(value);
const pair = (first, second) => `${money(first)} / ${money(second)}`;
const set = (id, value) => { document.getElementById(id).textContent = value; };

function update() {
  const inHome = careType.value === 'inHome';
  const showAge = !inHome && careType.value !== 'belowSchool';
  document.getElementById('age-field').hidden = !showAge;
  youngChildren.disabled = !showAge;
  for (const option of youngChildren.options) {
    option.disabled = option.value !== 'all' && Number(option.value) >= Number(children.value);
  }
  if (youngChildren.selectedOptions[0]?.disabled) youngChildren.value = 'all';
  set('fee-label', inHome ? 'Provider daily fee per family (A$)' : 'Provider daily fee per child (A$)');

  try {
    const estimate = calculateCCS({
      ati: ati.valueAsNumber, dailyFee: dailyFee.valueAsNumber,
      sessionHours: sessionHours.valueAsNumber, withholding: withholding.valueAsNumber,
      careType: careType.value, daysPerWeek: Number(daysPerWeek.value),
      children: Number(children.value), hoursTier: Number(hoursTier.value),
      youngChildren: showAge && youngChildren.value !== 'all'
        ? Number(youngChildren.value) : Number(children.value),
    });
    const { fortnight, annual } = estimate;
    set('weekly-cost', money(estimate.weeklyOutOfPocket));
    set('annual-cost', money(annual.outOfPocket));
    set('hourly-fee-cap', pair(estimate.hourlyFee, estimate.cap));
    set('hourly-gap', money(estimate.hourlyGap));
    set('subsidy-base', money(estimate.hourlyBase));
    set('covered-hours', `${hours.format(fortnight.subsidisedHours)} out of ${hours.format(fortnight.bookedHours)} h`);
    set('uncovered-hours', `${hours.format(fortnight.unsubsidisedHours)} h`);
    set('standard-rate', `${estimate.standard.toFixed(2)}%`);
    set('sibling-rate', estimate.higherRateChildren && estimate.higher > estimate.standard
      ? `${estimate.higher.toFixed(2)}% × ${estimate.higherRateChildren}`
      : 'Standard rate applies');
    set('gross-ccs', pair(fortnight.grossCCS, annual.grossCCS));
    set('paid-ccs', pair(fortnight.paidCCS, annual.paidCCS));
    set('held-ccs', pair(fortnight.withheld, annual.withheld));
    set('gap-before-withholding', money(annual.gapBeforeWithholding));
    set('fourth-day', money(estimate.fourthDayCost));
    set('fifth-day', money(estimate.fifthDayCost));
    error.hidden = true;
    results.hidden = false;
    status.textContent = `Estimated out-of-pocket cost ${money(estimate.weeklyOutOfPocket)} per week and ${money(annual.outOfPocket)} per year.`;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    status.textContent = '';
    error.textContent = issue.message;
    error.hidden = false;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
