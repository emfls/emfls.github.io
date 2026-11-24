import { calculateContributions, compareEarlyWithdrawal } from './model.mjs';

const byId = (id) => document.getElementById(id);
const contributions = byId('contribution-form');
const withdrawal = byId('withdrawal-form');
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const money = (amount) => dollars.format(amount);
const setText = (id, text) => { byId(id).textContent = text; };

function readNumbers(form) {
  const values = {};
  for (const input of form.querySelectorAll('input[type="number"]')) {
    if (input.matches(':disabled')) continue;
    input.removeAttribute('aria-invalid');
    if (!input.validity.valid) {
      input.setAttribute('aria-invalid', 'true');
      const label = input.labels[0].textContent.trim();
      throw new RangeError(`${label}. ${input.validationMessage}`);
    }
    values[input.name] = input.valueAsNumber;
  }
  return values;
}

function describePlan(label, result) {
  const catchUps = [];
  if (result.ageCatchUp) catchUps.push(`${money(result.ageCatchUp)} age-based`);
  if (result.specialCatchUp) catchUps.push(`${money(result.specialCatchUp)} special pre-retirement`);
  if (result.serviceCatchUp) catchUps.push(`${money(result.serviceCatchUp)} 15-year service`);
  const detail = catchUps.length ? ` (includes ${catchUps.join(' and ')} catch-up)` : '';
  return `${label} — ${money(result.total)}${detail}`;
}

function updateContributions() {
  const controls = contributions.elements;
  const planType = controls.planType.value;
  const is403b = planType === '403b';
  const workplaceLabel = is403b ? '403(b)' : '401(k)';
  const specialEnabled = controls.enableSpecial.checked;
  byId('special-settings').disabled = !specialEnabled;
  byId('service-options').hidden = !is403b;
  byId('service-settings').disabled = !is403b || !controls.enableService.checked;
  setText('workplace-legend', workplaceLabel);

  try {
    const result = calculateContributions({
      ...readNumbers(contributions),
      planType,
      ageCatchUp457: controls.ageCatchUp457.checked,
      ageCatchUpWorkplace: controls.ageCatchUpWorkplace.checked,
      roth457: controls.roth457.checked,
      rothWorkplace: controls.rothWorkplace.checked,
    });
    setText('combined', money(result.combined));
    setText('pretax', money(result.preTaxEligible));
    setText('roth', money(result.mandatoryRoth));
    setText('summary-457', describePlan('Governmental 457(b)', result.governmental457));
    setText('summary-workplace', describePlan(workplaceLabel, result.workplace));

    const messages = [];
    if (specialEnabled && !result.specialWindow) {
      messages.push('2026 falls outside the three calendar years before your plan’s normal retirement year.');
    }
    if (result.governmental457.blockedByRoth) {
      messages.push('The governmental 457(b) age-based catch-up requires a Roth option at the wages entered.');
    }
    if (result.workplace.blockedByRoth) {
      messages.push(`The ${workplaceLabel} age-based catch-up requires a Roth option at the wages entered.`);
    }
    setText('plan-message', messages.join(' '));
    byId('plan-message').hidden = !messages.length;
    byId('contribution-results').hidden = false;
    setText('contribution-error', '');
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    byId('contribution-results').hidden = true;
    setText('contribution-error', error.message);
  }
}

function updateWithdrawal() {
  try {
    const result = compareEarlyWithdrawal(readNumbers(withdrawal));
    setText('withdrawal-457', money(result.governmental457Tax));
    setText('saved-workplace', money(result.workplaceTax - result.governmental457Tax));
    setText('saved-ira', money(result.iraTax - result.governmental457Tax));
    byId('withdrawal-results').hidden = false;
    setText('withdrawal-error', '');
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    byId('withdrawal-results').hidden = true;
    setText('withdrawal-error', error.message);
  }
}

for (const [form, update] of [[contributions, updateContributions], [withdrawal, updateWithdrawal]]) {
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', update);
  update();
}
