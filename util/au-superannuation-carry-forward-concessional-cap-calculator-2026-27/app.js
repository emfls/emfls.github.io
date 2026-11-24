import { CURRENT_CAP, daysUntilExpiry, estimateContribution } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const fields = [...form.querySelectorAll('input')];
const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const sydneyDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
});
const text = (id, value) => { byId(id).textContent = value; };
const notice = (id, message) => {
  text(id, message);
  byId(id).hidden = !message;
};

function updateCountdown() {
  const today = Object.fromEntries(sydneyDate.formatToParts().map(({ type, value }) => [type, value]));
  const days = daysUntilExpiry(`${today.year}-${today.month}-${today.day}`);
  let message = 'The 2021–22 carry-forward deadline has passed. Results show a 2026–27 scenario.';
  if (days > 0) message = `${days} calendar ${days === 1 ? 'day' : 'days'} until the deadline (Sydney time).`;
  if (days === 0) message = 'Today is the deadline (Sydney time). Check whether your fund can still receive the contribution today.';
  text('countdown', message);
  return days;
}

function renderLedger(years) {
  const rows = years.map(({ year, unused, used, remaining }, index) => {
    const row = document.createElement('tr');
    if (index === 0) row.className = 'expiring';
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year;
    row.append(heading);
    for (const amount of [unused, used, remaining]) {
      row.insertCell().textContent = aud.format(amount);
    }
    return row;
  });
  byId('ledger').replaceChildren(...rows);
}

function update() {
  const days = updateCountdown();
  let invalidField;
  for (const field of fields) {
    const value = field.valueAsNumber;
    if (field.validity.valid && Math.round(value * 100) / 100 === value) {
      field.removeAttribute('aria-invalid');
    } else {
      field.setAttribute('aria-invalid', 'true');
      invalidField ??= field;
    }
  }
  byId('results').hidden = !!invalidField;
  if (invalidField) {
    const label = invalidField.labels[0].textContent;
    notice('input-error', `${label} must be between $0 and ${aud.format(Number(invalidField.max))}, with up to two decimal places.`);
    notice('expiry-balance', '');
    return;
  }
  notice('input-error', '');

  const plannedContribution = byId('planned').valueAsNumber;
  const estimate = estimateContribution({
    tsbJune30: byId('tsb').valueAsNumber,
    taxableIncome: byId('income').valueAsNumber,
    existingConcessional: byId('existing').valueAsNumber,
    plannedContribution,
    unusedByYear: [2021, 2022, 2023, 2024, 2025].map(year => byId(`cap-${year}`).valueAsNumber),
  });
  byId('ineligible').hidden = estimate.eligible;
  notice('excess', estimate.excess
    ? `Excess concessional contributions warning: your combined plan exceeds the available cap by ${aud.format(estimate.excess)}. The ATO may assess extra tax on the excess.`
    : '');

  const expiring = aud.format(estimate.expiringUnused);
  let expiryMessage = 'Your plan leaves no unused 2021–22 cap at the deadline.';
  if (estimate.expiringUnused > 0 && !estimate.eligible) {
    expiryMessage = `Your balance makes ${expiring} of 2021–22 unused cap unavailable in 2026–27.`;
  } else if (estimate.expiringUnused > 0) {
    expiryMessage = `Your plan leaves ${expiring} of 2021–22 cap unused at the deadline.`;
  }
  notice('expiry-balance', days >= 0 ? expiryMessage : '');

  const output = {
    'total-cap': estimate.totalCap,
    'additional-room': estimate.additionalRoom,
    'net-benefit': estimate.netTaxBenefit,
    'modelled': estimate.modelledContribution,
    'income-tax-saved': estimate.incomeTaxSaved,
    'medicare-saved': estimate.medicareSaved,
    'personal-tax-saved': estimate.personalTaxSaved,
    'contributions-tax': estimate.contributionsTax,
    'div293': estimate.division293Added,
    'super-boost': estimate.superBoost,
  };
  for (const [id, amount] of Object.entries(output)) text(id, aud.format(amount));
  text('allocation', `Your plan totals ${aud.format(estimate.totalConcessional)}. It uses ${aud.format(estimate.currentUsed)} of the ${aud.format(CURRENT_CAP)} current cap. Carry-forward available at the start of the plan is ${aud.format(estimate.carryForward)}. Room left after your plan is ${aud.format(estimate.remainingRoom)}.`);
  renderLedger(estimate.years);

  if (estimate.modelledContribution < plannedContribution) {
    notice('projection-note', 'The tax figures cover the portion of your planned contribution within both the remaining cap and your taxable income. The cap usage above reflects your full proposed concessional amount.');
  } else {
    notice('projection-note', '');
  }
  notice('div293-note', estimate.division293Before || estimate.division293After
    ? `Estimated total Division 293 tax changes from ${aud.format(estimate.division293Before)} to ${aud.format(estimate.division293After)}.`
    : '');
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
window.addEventListener('focus', update);
update();

for (const unit of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (unit.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
