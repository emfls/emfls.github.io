import { calculateContributions, projectGrowth } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = value => currency.format(value === 0 ? 0 : value);
const resultKeys = ['megaAfterTaxRoom', 'usableAfterTaxRoom', 'totalPlanContributions', 'perPaycheck', 'catchUp'];
const growthKeys = ['advantage', 'rothNet', 'brokerageNet', 'taxableConversionEarnings', 'conversionTax', 'conversionTaxDrag'];
const numericInputs = [...form.querySelectorAll('input[type="number"]')];

const catchUpMessages = {
  'age-ineligible': 'Catch-up does not apply to your age bracket.',
  'no-catch-up': 'No catch-up contribution selected.',
  'roth-optional': 'A Roth catch-up election is optional at the 2025 wage amount entered, subject to plan rules.',
  'roth-required': 'Roth catch-up required. Your Roth election satisfies the wage rule for this estimate.',
  'roth-election-needed': 'Roth catch-up required. Select Roth to include a catch-up contribution in the estimate.'
};

function writeAmounts(keys, values) {
  for (const key of keys) {
    byId(key).textContent = values[key] === null ? 'Unavailable' : money(values[key]);
  }
}

function update() {
  const years = byId('horizonYears');
  const delay = byId('delayDays');
  const horizonIsValid = years.validity.valid;
  delay.max = horizonIsValid ? String(years.valueAsNumber * 365) : '21900';

  for (const field of numericInputs) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }
  const invalidField = numericInputs.find(field => !field.validity.valid);
  if (invalidField) {
    byId('form-error').textContent = [
      invalidField.labels[0].textContent.trim(), invalidField.validationMessage
    ].join(' — ');
    byId('results').hidden = true;
    byId('projection').hidden = true;
    return;
  }

  const numbers = Object.fromEntries(numericInputs.map(field => [field.name, field.valueAsNumber]));
  const planSupportsMega = byId('planSupportsMega').checked;
  const plan = calculateContributions({
    ...numbers,
    ageBracket: byId('ageBracket').value,
    catchUpElection: byId('catchUpElection').value,
    planSupportsMega,
    payPeriods: Number(byId('payPeriods').value)
  });
  writeAmounts(resultKeys, plan);
  byId('regular-used').textContent = money(plan.baseElectiveDeferral);
  byId('catchup-status').textContent = catchUpMessages[plan.catchUpStatus];

  const notes = [];
  if (plan.baseDeferralReduction > 0) {
    notes.push(`The regular deferral was reduced by ${money(plan.baseDeferralReduction)} to fit eligible pay and the shared deferral limit.`);
  }
  if (plan.excessAnnualAdditions > 0) {
    notes.push(`Regular deferrals and employer additions exceed the annual additions limit by ${money(plan.excessAnnualAdditions)}. Review the inputs with your plan administrator.`);
  }
  if (plan.excessOtherDeferrals > 0) {
    notes.push(`Other regular deferrals exceed the shared limit by ${money(plan.excessOtherDeferrals)}. Review that total before using this estimate.`);
  }
  if (!planSupportsMega) {
    notes.push('Usable room is $0 because plan support is turned off.');
  } else if (plan.totalPlanContributions !== null && plan.usableAfterTaxRoom < plan.megaAfterTaxRoom) {
    notes.push('The catch-up and regular deferral leave less gross pay available than the statutory after-tax room.');
  }
  if (plan.catchUp === 0 && ['roth-optional', 'roth-required'].includes(plan.catchUpStatus) && plan.totalPlanContributions !== null) {
    notes.push('No catch-up is included because regular deferrals have not reached $24,500 or eligible pay is exhausted.');
  }
  byId('plan-notice').textContent = notes.join(' ');

  const hasProjection = plan.usableAfterTaxRoom > 0;
  byId('projection-title').textContent = `Projected net wealth after ${numbers.horizonYears} years`;
  byId('projection-status').textContent = hasProjection
    ? '' : 'The comparison requires a positive usable after-tax amount.';
  byId('projection-status').hidden = hasProjection;
  byId('projection-values').hidden = !hasProjection;
  if (hasProjection) {
    writeAmounts(growthKeys, projectGrowth({ ...numbers, principal: plan.usableAfterTaxRoom }));
  }
  byId('form-error').textContent = '';
  byId('results').hidden = false;
  byId('projection').hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();

for (const ad of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(ad.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
