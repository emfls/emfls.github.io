import { calculateDivision293, RULES } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('tax-form');
const fields = [...form.querySelectorAll('input[type="number"]')];
const inputError = byId('input-error');
const results = byId('results');
const carryOutcome = byId('carry-outcome');
const comparison = byId('comparison');
const comparisonNote = byId('comparison-note');

const currency = new Intl.NumberFormat('en-AU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 2,
});
const money = (amount) => `${amount < 0 ? '−' : ''}A$${currency.format(Math.abs(amount))}`;
const setMoney = (id, amount) => { byId(id).textContent = money(amount); };
const moneyFields = [
  'div293Tax', 'div293Income', 'totalConcessionalContributions', 'applicableConcessionalCap',
  'carryForwardUsed', 'lowTaxContrib', 'excessConcessionalContributions', 'combined',
  'excessOver250k', 'taxableContributions', 'fundTax', 'totalTaxOnLowTaxContributions',
];

function render() {
  for (const field of fields) {
    const value = field.valueAsNumber;
    const precisionIsInvalid = Number.isFinite(value) && Math.round(value * 100) / 100 !== value;
    field.setCustomValidity(precisionIsInvalid ? 'Enter no more than two decimal places.' : '');
  }
  const invalidFields = fields.filter((field) => !field.validity.valid);
  for (const field of fields) {
    field.setAttribute('aria-invalid', String(!field.validity.valid));
  }

  inputError.hidden = invalidFields.length === 0;
  results.hidden = invalidFields.length > 0;
  carryOutcome.hidden = true;
  if (invalidFields.length) {
    const firstInvalid = invalidFields[0];
    inputError.textContent = `${firstInvalid.labels[0].textContent}. Enter an amount between ${money(Number(firstInvalid.min))} and ${money(Number(firstInvalid.max))} with up to two decimal places.`;
    return;
  }

  inputError.textContent = '';
  const inputs = Object.fromEntries(fields
    .filter((field) => field.value !== '')
    .map((field) => [field.name, field.valueAsNumber]));
  const estimate = calculateDivision293(inputs);
  for (const key of moneyFields) setMoney(key, estimate[key]);
  byId('effectiveSuperTaxRate').textContent = estimate.effectiveSuperTaxRate === null
    ? 'N/A' : percent.format(estimate.effectiveSuperTaxRate);
  byId('excess-note').hidden = estimate.excessConcessionalContributions === 0;
  setMoney('cash-outlay', estimate.cashPayment.cashOutlay);
  setMoney('cash-retained', estimate.cashPayment.superRetained);
  setMoney('super-outlay', estimate.superPayment.cashOutlay);
  setMoney('super-retained', estimate.superPayment.superRetained);

  const voluntary = estimate.voluntaryComparison;
  comparison.hidden = voluntary === null;
  comparisonNote.hidden = voluntary !== null;
  if (voluntary) {
    for (const [key, amount] of Object.entries(voluntary)) setMoney(key, amount);
  } else if (!inputs.voluntaryContributions) {
    comparisonNote.textContent = 'Enter a voluntary contribution to compare it with taking the amount as income.';
  } else if (estimate.excessConcessionalContributions > 0) {
    comparisonNote.textContent = 'The 47% comparison is unavailable because contributions exceed your applicable cap.';
  } else {
    comparisonNote.textContent = `The 47% comparison is unavailable because entered taxable income is below ${money(RULES.topBracketFloor)}.`;
  }

  if (estimate.carryForwardUsed > 0) {
    const crossing = estimate.carryForwardCrossedThreshold
      ? 'Using the carried-forward amount takes the combined figure above A$250,000. '
      : '';
    carryOutcome.textContent = `${crossing}At the entered income, using ${money(estimate.carryForwardUsed)} of carried-forward cap changes estimated Division 293 tax by ${money(estimate.carryForwardDiv293Increase)} compared with counting only the general cap.`;
    carryOutcome.hidden = false;
  } else if (inputs.unusedCap > 0 && !estimate.carryForwardEligible) {
    carryOutcome.textContent = inputs.totalSuperBalance === undefined
      ? 'The estimate uses the general cap. Enter your 30 June 2026 balance to check carry-forward eligibility.'
      : 'The estimate uses the general cap because the entered balance is A$500,000 or more.';
    carryOutcome.hidden = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
form.addEventListener('input', render);
render();
