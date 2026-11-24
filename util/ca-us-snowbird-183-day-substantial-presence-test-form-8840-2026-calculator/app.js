import {
  calculateSPT, checkHealthCoverage, checkVisitorDays, FORM_8840_MAX_DAYS,
  provinces, REPEATABLE_ANNUAL_DAYS
} from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('snowbird-calculator');
const province = byId('province');
const provinceDays = byId('province-days');
const rollingDays = byId('rolling-days');
const closerConnection = byId('closer-connection');
const taxResults = byId('tax-results');

const taxMessages = {
  NON_RESIDENT_SAFE: ['SAFE UNDER THE SPT', 'Your day counts do not trigger the SPT. Form 8840 is unnecessary for this test. Other U.S. filing obligations can still apply.'],
  FORM_8840_REQUIRED: ['CHECK FORM 8840 ELIGIBILITY', 'Your days meet the SPT and are within the Form 8840 day cap. Confirm the closer-connection conditions before claiming the exception.'],
  SPT_MET_NO_CLOSER_CONNECTION: ['SPT MET · REVIEW RESIDENCY', 'Your answer indicates that the closer-connection exception is unavailable. Review how to file as a U.S. resident or whether you qualify for treaty relief.'],
  US_TAX_RESIDENT_TREATY_8833_ONLY: ['CRITICAL · 183+ DAY U.S. TAX RESIDENT UNDER THE SPT', 'Form 8840 is barred. If you qualify as a Canadian resident under the treaty tie-breaker and claim that position, file Form 1040-NR with Form 8833. Otherwise, review U.S. resident filing obligations.']
};

function updateTax() {
  try {
    const tax = calculateSPT(
      byId('days2026').valueAsNumber, byId('days2025').valueAsNumber,
      byId('days2024').valueAsNumber, closerConnection.value
    );
    let [badge, guidance] = taxMessages[tax.verdict];
    if (tax.verdict === 'FORM_8840_REQUIRED' && tax.closerConnection === 'yes') {
      badge = 'FILE FORM 8840 · CHECK YOUR DEADLINE';
      guidance = 'Based on your answer, file Form 8840 to claim the exception. June 15, 2027 is the usual deadline if you had no wages subject to U.S. withholding. Follow your applicable Form 1040-NR due date, including any extension.';
    }
    byId('tax-badge').textContent = badge;
    byId('tax-badge').dataset.tone = tax.barredByDays ? 'risk' : tax.meetsSPT ? 'review' : 'pass';
    byId('tax-guidance').textContent = guidance;
    byId('weighted').textContent = `${tax.weightedDays.toFixed(2)} days`;
    const fraction = tax.weightedSixths % 6;
    const exactFractions = ['', '⅙', '⅓', '½', '⅔', '⅚'];
    const exact = fraction ? `${tax.wholeWeightedDays} ${exactFractions[fraction]}` : tax.wholeWeightedDays;
    byId('weighted-detail').textContent = `Exact total: ${exact} · Truncated display: ${tax.wholeWeightedDays}`;
    byId('safe-remaining').textContent = `${tax.remainingWithoutSPT} days`;
    byId('safe-cap').textContent = `2026 maximum: ${tax.maxDaysWithoutSPT} days${tax.maxDaysWithoutSPT > tax.weightedOnlyMaxDays ? ' (31-day minimum applies)' : ''}`;
    byId('form-remaining').textContent = `${tax.remainingUnder8840DayCap} days`;
    byId('form-cap').textContent = `2026 day cap: ${FORM_8840_MAX_DAYS} days · Eligibility conditions apply`;
    byId('steady-state').textContent = `${REPEATABLE_ANNUAL_DAYS} days/year`;
    byId('tax-error').textContent = '';
    taxResults.hidden = false;
  } catch (error) {
    taxResults.hidden = true;
    byId('tax-error').textContent = error.message;
  }
}

function updateVisitor() {
  try {
    const value = rollingDays.value === '' && !rollingDays.validity.badInput
      ? null : rollingDays.valueAsNumber;
    const flag = checkVisitorDays(value);
    const calendarFlag = byId('days2026').validity.valid && checkVisitorDays(byId('days2026').valueAsNumber);
    byId('visitor-status').textContent = flag === true || calendarFlag
      ? 'Travel review advised · 183+ days in an entered period'
      : flag === false ? 'Rolling total within the 182-day planning screen'
      : 'Enter a rolling total to check the travel screen.';
  } catch (error) {
    byId('visitor-status').textContent = error.message;
  }
}

function updateHealth() {
  const rule = provinces[province.value];
  provinceDays.max = rule.window === 'any 12-month period' ? 366 : 365;
  byId('province-label').textContent = rule.countsAbsences
    ? 'Counted days away from Québec' : 'Days physically in your province';
  byId('province-help').textContent = rule.countsAbsences
    ? '2026 only. Exclude departure and return days and absences of 21 consecutive days or less.'
    : `Use ${rule.window}. For a rolling rule, check each relevant 12-month window.`;
  try {
    const { margin, meetsBaseline, estimate } = checkHealthCoverage(province.value, provinceDays.valueAsNumber);
    const amount = Math.abs(margin);
    const measure = estimate ? '183-day planning screen' : 'standard day-count rule';
    const detail = rule.countsAbsences
      ? meetsBaseline ? 'of counted absences available' : 'over the absence cap'
      : meetsBaseline ? 'above the presence threshold' : 'short of the presence threshold';
    byId('health-status').textContent = `${meetsBaseline ? 'Within' : 'Coverage review advised · Outside'} the ${measure} (${amount} ${amount === 1 ? 'day' : 'days'} ${detail}).`;
  } catch (error) {
    byId('health-status').textContent = error.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  // The province can change the period and whether the count means presence or absence.
  if (event.target === province) provinceDays.value = '';
  updateTax();
  updateVisitor();
  updateHealth();
});
updateTax();
updateVisitor();
updateHealth();
