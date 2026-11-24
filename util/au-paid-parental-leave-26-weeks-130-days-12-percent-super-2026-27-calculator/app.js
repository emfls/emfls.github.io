import { estimateLeave, PARAMS } from './model.mjs';

const byId = (id) => document.getElementById(id);
const formatMoney = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const money = (value) => formatMoney.format(value);
const days = (value) => `${value} ${value === 1 ? 'day' : 'days'}`;
const household = byId('household');
const partnerFields = byId('partner-fields');
const form = byId('leave-form');
const errorMessage = byId('input-error');
const results = byId('estimate-results');

const incomeLabels = {
  individual: 'individual ATI pass',
  family: 'family ATI pass',
  fail: 'ATI fail',
};

const workLabels = {
  pass: 'work test pass',
  fail: 'work test fail',
  'primary-required': 'primary parent’s work test required',
};

function readParent(prefix) {
  const value = (field) => byId(`${prefix}-${field}`).valueAsNumber;
  return {
    ati: value('ati'),
    otherIncome: value('income'),
    employerPay: value('employer'),
    work: { qualifyingDays: value('period'), hours: value('hours'), gapWeeks: value('gap') },
  };
}

function status({ incomeTest, workTest, days: count }) {
  return `${days(count)} · ${incomeLabels[incomeTest]} · ${workLabels[workTest]}`;
}

function render(result) {
  byId('primary-status').textContent = status(result.primary);
  byId('partner-status-row').hidden = !result.partner;
  byId('partner-status').textContent = result.partner ? status(result.partner) : '';
  byId('unused-days').textContent = days(result.unusedDays);
  byId('concurrent-days').textContent = days(result.maxConcurrentDays);

  const amounts = {
    'government-gross': result.governmentGross,
    'government-net': result.governmentNet,
    'employer-gross': result.employerGross,
    'employer-net': result.employerNet,
    'cash-net': result.cashNet,
    'government-super': result.governmentSuper,
    'total-value': result.totalValue,
  };
  for (const [id, value] of Object.entries(amounts)) {
    byId(id).textContent = money(value);
  }

  byId('super-breakdown').textContent = result.partner
    ? `ATO base super by recipient • Primary parent ${money(result.primary.super)} · Partner ${money(result.partner.super)}`
    : '';
  byId('unused-note').textContent = result.unusedDays
    ? `${days(result.unusedDays)} unused in this plan, worth ${money(result.unusedDays * PARAMS.dailyRateCents / 100)} before tax.`
    : '';
}

function update() {
  const partnered = household.value === 'couple';
  partnerFields.hidden = !partnered;
  partnerFields.disabled = !partnered;

  const invalid = [...form.querySelectorAll('input[type="number"]')]
    .find((input) => input.willValidate && !input.validity.valid);
  if (invalid) {
    results.hidden = true;
    errorMessage.textContent = `${invalid.closest('fieldset').querySelector('legend').textContent} · ${invalid.labels[0].textContent}. ${invalid.validationMessage}`;
    return;
  }

  const result = estimateLeave({
    primary: readParent('primary'),
    partner: partnered ? readParent('partner') : null,
    requestedPartnerDays: byId('partner-days').valueAsNumber,
    assessmentYear: byId('assessment-year').value,
    partnerNeedsPrimaryWork: byId('claim-type').value === 'linked',
  });
  render(result);
  errorMessage.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
