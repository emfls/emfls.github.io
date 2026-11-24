import { calculate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const values = byId('estimate-values');
const inputError = byId('input-error');
const electionWarning = byId('election-warning');

const moneyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const money = (amount) => moneyFormat.format(amount);

const numericInputs = Array.from(form.querySelectorAll('input[type="number"]'));

function render() {
  const status = byId('status').value;
  byId('earned-label').textContent = status === 'mfj'
    ? 'Lower-earning spouse’s earned income ($)'
    : 'Your earned income ($)';

  const invalid = numericInputs.find((input) => !input.validity.valid);
  if (invalid) {
    inputError.textContent = `${invalid.labels[0].textContent} — ${invalid.validationMessage}`;
    values.hidden = true;
    return;
  }

  const taxLimit = byId('tax-limit');
  try {
    const result = calculate({
      status,
      qualifyingPersons: Number(byId('qualifying-persons').value),
      agi: byId('agi').valueAsNumber,
      earnedIncome: byId('earned-income').valueAsNumber,
      careCosts: byId('care-costs').valueAsNumber,
      election: byId('election').valueAsNumber,
      marginalRate: byId('marginal-rate').valueAsNumber,
      planLimit: byId('plan-limit').valueAsNumber,
      taxLimit: taxLimit.value === '' ? null : taxLimit.valueAsNumber,
    });

    const { optimal } = result;
    byId('credit-rate').textContent = `${result.rate}%`;
    byId('credit-expenses').textContent = money(result.creditExpenses);
    byId('credit').textContent = money(result.credit);
    byId('credit-gain').textContent = money(result.creditGain);
    byId('fsa-savings').textContent = money(result.fsaSavings);
    byId('combined-savings').textContent = money(result.combinedSavings);
    byId('recommendation').textContent =
      `Elect ${money(optimal.election)} for an estimated ${money(optimal.combinedSavings)} in combined savings ` +
      `(${money(optimal.fsaSavings)} from the FSA and ${money(optimal.credit)} from the credit at ${optimal.rate}%). ` +
      (optimal.additionalSavings > 0
        ? `That’s ${money(optimal.additionalSavings)} above your current estimate.`
        : 'Your current election achieves the same estimated tax savings.');
    byId('comparison-note').textContent =
      `The prior rates give ${money(result.pre2026Credit)} at ${result.pre2026Rate}% on the same expense base. ` +
      (taxLimit.value === '' ? 'The credit estimate assumes sufficient federal tax liability.' : 'Your entered tax liability limit applies.');
    electionWarning.hidden = result.unexcludedElection === 0;
    electionWarning.textContent = result.unexcludedElection > 0
      ? `${money(result.unexcludedElection)} of your election is outside the estimated tax-free exclusion. Check your plan for possible forfeiture or taxable reimbursements.`
      : '';

    inputError.textContent = '';
    values.hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    inputError.textContent = error.message;
    values.hidden = true;
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('change', (event) => {
  if (event.target instanceof HTMLSelectElement) render();
});
render();
