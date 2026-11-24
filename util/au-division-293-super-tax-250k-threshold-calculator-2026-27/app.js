import { calculateDivision293, comparePayment, estimateSuperGuarantee } from './model.mjs';

const byId = (id) => document.getElementById(id);
const taxForm = byId('tax-form');
const comparisonForm = byId('comparison-form');
const taxResults = byId('tax-results');
const comparisonResults = byId('comparison-results');
const taxError = byId('tax-error');
const comparisonError = byId('comparison-error');
const taxFields = document.querySelectorAll('[data-tax]');
const projectionFields = document.querySelectorAll('[data-projection]');
const qualifyingEarningsField = byId('qualifyingEarnings');
const employerContributionsField = byId('employerContributions');
const amounts = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentages = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 4 });

function money(value) {
  if (value === null) return 'Unavailable';
  return `${value <= -0.005 ? '−' : ''}A$${amounts.format(Math.abs(value))}`;
}

function readInputs(form) {
  const values = {};
  let firstError = '';
  for (const input of form.querySelectorAll('input[type="number"]')) {
    if (!input.validity.valid) {
      input.setAttribute('aria-invalid', 'true');
      firstError ||= `${input.labels[0].textContent} — enter a number from ${input.min} to ${input.max}, with up to two decimal places.`;
    } else {
      input.removeAttribute('aria-invalid');
    }
    values[input.name] = input.value === '' ? null : input.valueAsNumber;
  }
  return { values, firstError };
}

function showMessage(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function renderComparison(taxBill) {
  const { values, firstError } = readInputs(comparisonForm);
  showMessage(comparisonError, firstError);
  comparisonResults.hidden = !!firstError;
  if (firstError) return;

  const projection = comparePayment({
    taxBill,
    grossSuperReturn: values.grossSuperReturn / 100,
    netCashReturn: values.netCashReturn / 100,
  });
  for (const field of projectionFields) {
    field.textContent = money(projection[field.dataset.projection]);
  }
  byId('net-super-return').textContent = percentages.format(projection.netSuperReturn);

  const difference = projection.netDifferenceIfPayCash;
  let summary = 'Both payment options give the same projected wealth to the nearest cent.';
  if (taxBill === 0) {
    summary = 'There is no estimated bill to pay or release.';
  } else if (Math.abs(difference) >= 0.005) {
    const option = difference > 0 ? 'Paying from cash' : 'Releasing from super';
    summary = `${option} leaves ${money(Math.abs(difference))} more across cash and super after 15 years at these rates.`;
  }
  byId('comparison-summary').textContent = summary;
}

function render() {
  const { values, firstError } = readInputs(taxForm);
  const missingEmployer = values.qualifyingEarnings === null && values.employerContributions === null;
  const error = firstError || (missingEmployer ? 'Enter qualifying earnings or actual employer contributions.' : '');
  if (missingEmployer) {
    qualifyingEarningsField.setAttribute('aria-invalid', 'true');
    employerContributionsField.setAttribute('aria-invalid', 'true');
  }
  showMessage(taxError, error);
  taxResults.hidden = !!error;
  if (error) {
    comparisonResults.hidden = true;
    showMessage(comparisonError, 'Enter valid tax estimate inputs to compare payment options.');
    return;
  }

  const estimatedSg = values.qualifyingEarnings === null ? null : estimateSuperGuarantee(values.qualifyingEarnings);
  const employer = values.employerContributions ?? estimatedSg;
  const totalConcessionalContributions = employer + values.voluntaryContributions;
  const estimate = calculateDivision293({
    taxableIncome: values.taxableIncome,
    reportableFringeBenefits: values.reportableFringeBenefits,
    totalNetInvestmentLosses: values.totalNetInvestmentLosses,
    familyTrustDistributions: values.familyTrustDistributions ?? 0,
    zeroTaxSuperLumpSum: values.zeroTaxSuperLumpSum ?? 0,
    firstHomeSuperSaverRelease: values.firstHomeSuperSaverRelease ?? 0,
    totalConcessionalContributions,
    priorSuperBalance: values.priorSuperBalance,
    unusedCarryForward: values.unusedCarryForward ?? 0,
  });
  const results = { ...estimate, estimatedSg, employer, totalConcessionalContributions };
  for (const field of taxFields) {
    field.textContent = money(results[field.dataset.tax]);
  }

  byId('tax-explanation').textContent = `15% × ${money(estimate.taxableDiv293Amount)} in taxable contributions.`;
  const carryUnavailable = values.unusedCarryForward > 0 && !estimate.carryForwardEligible;
  showMessage(byId('carry-message'), carryUnavailable
    ? 'Carry-forward requires a confirmed total super balance below A$500,000 at 30 June 2026.'
    : '');
  byId('excess-message').hidden = estimate.excessConcessionalContributions === 0;
  renderComparison(estimate.div293TaxPayable);
}

for (const form of [taxForm, comparisonForm]) {
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', render);
}
render();
