import { calculateAted, PERIOD_DAYS, PERIOD_END, PERIOD_START } from './model.mjs';

const form = document.querySelector('#ated-form');
const fields = form.elements;
const result = document.querySelector('#result');
const error = document.querySelector('#error');
const reliefOptions = document.querySelector('#relief-options');
const reliefHelp = document.querySelector('#relief-help');
const priorRelief = document.querySelector('#prior-relief');
const breakdown = document.querySelector('#breakdown');

const sterling = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2
});
const dates = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });
const formatDate = iso => dates.format(new Date(iso));
const money = value => sterling.format(value);

const reliefChecks = {
  none: 'Select a relief to review the eligibility conditions.',
  rental: 'Commercial letting for profit to unconnected tenants, or active steps to let without undue delay. Check who is permitted to occupy the dwelling.',
  development: 'The dwelling is held for development and resale in a qualifying property development trade. Check restrictions on occupation by non-qualifying persons.',
  trading: 'The dwelling is held as stock for resale in a qualifying property trading business. Check restrictions on occupation by non-qualifying persons.',
  farmhouse: 'The farmhouse is occupied by a qualifying farm worker or former long-serving farm worker. Check the link to the farming trade and the occupation conditions.',
  employees: 'A qualifying employee or partner uses the dwelling for a qualifying trade or rental business. Check the duties and restrictions on ownership interests.'
};
const statuses = {
  OUT_OF_SCOPE: 'Out of scope for this period',
  TAXABLE_ATED: 'ATED return required',
  'RELIEF_RDR_REQUIRED_£0': 'Full relief · £0 · RDR required',
  RELIEF_RDR_ALREADY_FILED: 'Full relief · covered by existing RDR'
};

function show(id, text) {
  document.getElementById(id + '-result').textContent = text;
}

function render() {
  const relief = fields.relief.value;
  const acquisitionDate = fields.acquisition.value;
  const hasRelief = relief !== 'none';
  reliefOptions.hidden = !hasRelief;
  reliefHelp.textContent = reliefChecks[relief];
  priorRelief.hidden = acquisitionDate <= PERIOD_START || acquisitionDate > PERIOD_END;
  fields.reliefDays.disabled = !hasRelief || !fields.confirmed.checked;
  fields.priorRelief.disabled = priorRelief.hidden || !hasRelief || !fields.confirmed.checked;
  try {
    if (!fields.reliefDays.disabled && fields.reliefDays.validity.badInput) {
      throw new RangeError('Enter a valid number of qualifying days.');
    }
    const estimate = calculateAted({
      value: fields.value.valueAsNumber,
      acquisitionDate,
      disposalDate: fields.disposal.value,
      relief,
      reliefConfirmed: hasRelief && fields.confirmed.checked,
      reliefDays: fields.reliefDays.value ? fields.reliefDays.valueAsNumber : null,
      sameReliefAlreadyFiled: !fields.priorRelief.disabled && fields.priorRelief.checked,
      assessedOn: fields.assessed.value,
      includeDaily: fields.daily.checked
    });
    show('valuation', formatDate(estimate.valuationDate));
    show('band', estimate.band.label);
    show('annual', money(estimate.band.annualCharge));
    show('days', `${estimate.chargeableDays}/${PERIOD_DAYS} · ${estimate.ownedDays} owned · ${estimate.relievedDays} relieved`);
    show('tax', money(estimate.taxPayable));
    show('status', statuses[estimate.status]);
    show('deadline', estimate.deadline ? `${formatDate(estimate.deadline)} (${estimate.deadlineRule})` : 'No new return due');

    const penalty = estimate.penalty;
    show('penalty', penalty ? money(penalty.total) : (estimate.deadline ? 'Enter an assessment date' : 'Not applicable'));
    breakdown.hidden = !penalty;
    if (penalty) {
      breakdown.textContent = `${penalty.daysLate} days late · Initial ${money(penalty.initial)} · Daily ${money(penalty.daily)} (${penalty.dailyDays} days) · Six months ${money(penalty.sixMonths)} · Twelve months ${money(penalty.twelveMonths)}. The 12-month estimate assumes no deliberate withholding.`;
    }
    result.hidden = false;
    error.hidden = true;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    result.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('input', event => {
  if (event.target === fields.relief) {
    fields.confirmed.checked = false;
    fields.reliefDays.value = '';
    fields.priorRelief.checked = false;
  }
  if (event.target === fields.acquisition) fields.priorRelief.checked = false;
  render();
});
form.addEventListener('submit', event => event.preventDefault());
render();
