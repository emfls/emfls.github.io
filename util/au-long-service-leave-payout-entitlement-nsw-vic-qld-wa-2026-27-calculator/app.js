import { estimatePayout } from './model.mjs';

const form = document.getElementById('lsl-form');
const error = document.getElementById('input-error');
const estimate = document.getElementById('estimate');
const victorianWeeks = document.getElementById('victorian-weeks');
const fields = form.elements;
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const quantity = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 4 });
const statusText = {
  FULL_ENTITLEMENT: 'Full entitlement',
  PRO_RATA_ELIGIBLE: 'Eligible for a pro-rata payout',
  NOT_YET_ELIGIBLE: 'No payout for this service and exit reason',
};
const taxText = {
  marginal: 'Schedule 7 marginal pay-period method for normal termination.',
  lumpSumA: 'Schedule 7 applies 32% withholding (Lump Sum A).',
  death: 'Unused leave paid after death has zero PAYG withholding.',
};
const payLabels = { annual: 'Annual salary (AUD)', weekly: 'Weekly pay (AUD)', hourly: 'Hourly rate (AUD)' };
const payDefaults = { annual: 83200, weekly: 1600, hourly: 42.11 };
const payByBasis = { ...payDefaults };
let previousBasis = fields.payBasis.value;

function optionalNumber(field) {
  return field.value === '' && !field.validity.badInput ? undefined : field.valueAsNumber;
}

function time(weeks, hours) {
  return `${quantity.format(weeks)} wks · ${quantity.format(hours)} hrs`;
}

function render() {
  const basis = fields.payBasis.value;
  if (basis !== previousBasis) {
    payByBasis[previousBasis] = fields.pay.value;
    fields.pay.value = payByBasis[basis];
    previousBasis = basis;
  }
  document.querySelector('label[for="pay"]').textContent = payLabels[basis];

  victorianWeeks.hidden = fields.state.value !== 'VIC';
  fields.serviceWeeks.disabled = victorianWeeks.hidden;
  const invalid = [...form.querySelectorAll('input:not(:disabled)')].filter(field => !field.validity.valid);
  form.querySelectorAll('input').forEach(field => {
    field.setAttribute('aria-invalid', String(invalid.includes(field)));
  });

  const result = invalid.length ? null : estimatePayout({
    state: fields.state.value,
    serviceYears: fields.serviceYears.valueAsNumber,
    serviceWeeks: victorianWeeks.hidden ? undefined : optionalNumber(fields.serviceWeeks),
    reason: fields.reason.value,
    weeklyHours: fields.weeklyHours.valueAsNumber,
    payBasis: basis,
    pay: fields.pay.valueAsNumber,
    leaveUsed: fields.leaveUsed.valueAsNumber,
    frequency: fields.frequency.value,
    normalGross: optionalNumber(fields.normalGross),
    qualifyingEarningsYtd: optionalNumber(fields.qualifyingEarningsYtd),
  });

  error.hidden = Boolean(result);
  estimate.hidden = !result;
  if (!result) return;

  const values = {
    eligibility: statusText[result.eligibility],
    net: money.format(result.net),
    'weekly-rate': money.format(result.weeklyRate),
    accrued: time(result.accruedWeeks, result.accruedHours),
    payable: time(result.payableWeeks, result.payableHours),
    gross: money.format(result.gross),
    tax: money.format(result.taxWithheld),
    takeable: `${quantity.format(result.takeableWeeks)} wks`,
    'super-leave': money.format(result.superOnLeave),
    'super-payout': money.format(result.superOnPayout),
    'tax-method': taxText[result.treatment],
  };
  for (const [id, value] of Object.entries(values)) {
    document.getElementById(id).textContent = value;
  }
  document.getElementById('eligibility').dataset.status = result.eligibility;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
