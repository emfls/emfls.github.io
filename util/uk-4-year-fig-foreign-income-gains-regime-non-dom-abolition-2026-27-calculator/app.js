import { calculate, MONEY_FIELDS } from './model.mjs';

const form = document.querySelector('#fig-form');
const summary = document.querySelector('#summary');
const error = document.querySelector('#error');
const warning = document.querySelector('#claim-warning');
const results = document.querySelector('#tax-results');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const statusMessages = {
  ELIGIBLE_4YR_FIG: 'Eligible on the residence information entered',
  INELIGIBLE_10YR_RULE: 'Fewer than 10 consecutive non-UK tax years before the window began',
  'EXPIRED_YEAR_5+': 'The four-year window has ended',
  INELIGIBLE_NOT_UK_RESIDENT: 'You must be UK tax resident in the claim year',
};

function set(id, value) {
  document.getElementById(id).textContent = value;
}

function money(value) {
  return value === null || value === undefined ? '—' : gbp.format(value);
}

function threshold(value) {
  return value === null ? 'Above £1 billion' : money(value);
}

function render() {
  if (!form.checkValidity()) {
    error.textContent = 'Complete each field. Use whole tax years and GBP amounts to two decimal places. Enter 0 for amounts you do not have.';
    results.hidden = true;
    summary.textContent = '';
    warning.textContent = '';
    return;
  }

  const fields = form.elements;
  const inputs = {
    ukResident: fields.ukResident.value === 'yes',
    nonResidentYears: fields.nonResidentYears.valueAsNumber,
    residenceWindowYear: fields.residenceWindowYear.valueAsNumber,
    region: fields.region.value,
  };
  for (const field of MONEY_FIELDS) inputs[field] = fields[field].valueAsNumber;

  let result;
  try {
    result = calculate(inputs);
  } catch (problem) {
    error.textContent = problem.message;
    results.hidden = true;
    summary.textContent = '';
    warning.textContent = '';
    return;
  }

  const { status, arising, fig, netSavings, allowanceCost, breakEven, hasClaimAmounts } = result;
  error.textContent = '';
  results.hidden = false;
  set('status', status);
  set('status-explanation', statusMessages[status]);
  set('arising-tax', money(arising?.total));
  set('fig-tax', money(fig?.total));
  set('saving', money(netSavings));
  set('allowance-cost', money(allowanceCost));
  set('arising-pa', money(arising?.personalAllowance));
  set('income-credit', money(arising?.incomeCredit));
  set('gains-credit', money(arising?.gainsCredit));
  set('income-threshold', breakEven ? threshold(breakEven.foreignIncome) : '—');
  set('gains-threshold', breakEven ? threshold(breakEven.foreignGains) : '—');

  if (!fig) {
    summary.textContent = statusMessages[status] + '.';
    warning.textContent = '';
  } else if (!hasClaimAmounts) {
    summary.textContent = 'Enter qualifying foreign income or gains to compare a claim.';
    warning.textContent = 'The FIG column shows the hypothetical cost of removing the allowances.';
  } else if (netSavings === 0) {
    summary.textContent = 'Both routes produce the same estimated UK tax.';
    warning.textContent = 'The claim still removes the allowances for the year.';
  } else {
    const magnitude = Math.abs(netSavings);
    const amount = magnitude < 0.005 ? 'less than £0.01' : money(magnitude);
    const savesTax = netSavings > 0;
    summary.textContent = savesTax
      ? `A FIG claim lowers estimated UK tax by ${amount}.`
      : `A FIG claim raises estimated UK tax by ${amount}.`;
    warning.textContent = savesTax ? '' : 'Check your available foreign tax credits before giving up the allowances.';
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
