import {
  PRIOR_YEARS, calculateClaim, claimDeadline,
} from './model.mjs';

const form = document.getElementById('marriage-calculator');
const currentSettings = document.getElementById('current-settings');
const priorYears = document.getElementById('prior-years');
const result = document.getElementById('result');
const error = document.getElementById('input-error');

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
});
const displayDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
});

function ukToday() {
  const parts = Object.fromEntries(dateFormat.formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function yearLabel(year) {
  return `${year}/${String(year + 1).slice(-2)}`;
}

function claimStatus(estimate) {
  switch (estimate.status) {
    case 'couple':
      return 'This year requires a marriage or civil partnership and no Married Couple’s Allowance.';
    case 'donor-limit':
      return 'Donor income is above the £12,570 range covered by this estimate. Check eligibility with HMRC.';
    case 'no-recipient-tax':
      return 'The recipient has no Income Tax to reduce in this estimate.';
    case 'recipient-limit':
      return 'The recipient is above the qualifying rate band for this year, after any extension entered.';
    case 'expired':
      return `The claim deadline was ${displayDate.format(new Date(claimDeadline(estimate.year)))}.`;
    default: {
      const breakdown = `Recipient’s tax reduction ${pounds.format(estimate.recipientSaving)} · Donor’s extra tax ${pounds.format(estimate.donorCost)}`;
      if (estimate.netSaving < 0) return `${breakdown}. Claiming would increase your household tax.`;
      if (estimate.netSaving === 0) return `${breakdown}. Claiming would leave your household tax unchanged.`;
      return breakdown;
    }
  }
}

const priorRows = PRIOR_YEARS.map(year => {
  const row = document.createElement('div');
  row.className = 'prior-row';
  const label = document.createElement('label');
  label.className = 'year-toggle';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('aria-controls', `settings-${year}`);
  const deadline = displayDate.format(new Date(claimDeadline(year)));
  label.append(checkbox, `${yearLabel(year)} · claim by ${deadline}`);

  const settings = currentSettings.cloneNode(true);
  settings.id = `settings-${year}`;
  settings.querySelector('legend').textContent = `${yearLabel(year)} income and eligibility`;
  settings.hidden = true;
  settings.disabled = true;

  const summary = document.createElement('p');
  summary.className = 'note';
  summary.hidden = true;
  row.append(label, settings, summary);
  priorYears.append(row);
  return { year, checkbox, settings, summary };
});

function readSettings(settings) {
  const values = {};
  for (const control of settings.querySelectorAll('input, select')) {
    if (!control.validity.valid) {
      control.setAttribute('aria-invalid', 'true');
      const year = settings.querySelector('legend').textContent;
      const label = control.labels[0].textContent.trim();
      throw new RangeError(`${year}: enter a valid amount for ${label.toLowerCase()}.`);
    }
    if (control.type === 'number') {
      values[control.name] = control.value === '' ? 0 : control.valueAsNumber;
    } else {
      values[control.name] = control.name === 'qualifyingCouple' ? control.value === 'yes' : control.value;
    }
  }
  return values;
}

function render() {
  const today = ukToday();
  const oldestDeadline = claimDeadline(PRIOR_YEARS[0]);
  if (today > oldestDeadline) {
    document.getElementById('deadline-title').textContent = 'The 2022/23 claim window has closed';
    document.getElementById('deadline-detail').textContent = 'The deadline was 5 April 2027. Check the dates below for the other years.';
  }
  const selected = {};
  form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));

  for (const { year, checkbox, settings, summary } of priorRows) {
    const expired = today > claimDeadline(year);
    checkbox.disabled = expired;
    if (expired) checkbox.checked = false;
    settings.hidden = settings.disabled = !checkbox.checked;
    summary.hidden = !expired;
    summary.textContent = expired ? claimStatus({ year, status: 'expired' }) : '';
  }

  try {
    const current = readSettings(currentSettings);
    for (const { year, checkbox, settings } of priorRows) {
      if (checkbox.checked) selected[year] = readSettings(settings);
    }
    const estimate = calculateClaim(current, selected, today);
    document.getElementById('current-saving').textContent = pounds.format(estimate.current.netSaving);
    document.getElementById('prior-saving').textContent = pounds.format(estimate.priorNetSaving);
    document.getElementById('combined-saving').textContent = pounds.format(estimate.combinedNetSaving);
    document.getElementById('current-breakdown').textContent = `2026/27 · ${claimStatus(estimate.current)}`;
    document.getElementById('prior-breakdown').textContent = estimate.prior.length
      ? `Selected past years · Estimated recipient rebate ${pounds.format(estimate.priorRecipientSaving)} · Donor’s extra tax ${pounds.format(estimate.priorDonorCost)}`
      : 'Select past years to estimate a backdated rebate.';
    for (const { year, summary } of priorRows) {
      const past = estimate.prior.find(row => row.year === year);
      if (past) {
        summary.hidden = false;
        summary.textContent = `${claimStatus(past)} · Household saving ${pounds.format(past.netSaving)}`;
      }
    }
    error.textContent = '';
    result.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    result.hidden = true;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
