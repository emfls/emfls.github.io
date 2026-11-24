import { calculateSalt, SALT_PARAMETERS } from './model.mjs';

const form = document.getElementById('salt-form');
const fields = form.elements;
const estimate = document.getElementById('estimate');
const error = document.getElementById('input-error');
const spouseOption = document.getElementById('spouse-option');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const verdicts = {
  itemize: 'Itemizing gives the larger deduction.',
  standard: 'The basic standard deduction is larger.',
  tie: 'Both options give the same deduction.'
};

function render() {
  const filingStatus = fields.filingStatus.value;
  spouseOption.hidden = filingStatus !== 'mfs';

  const invalidField = [...fields].find(field => !field.validity.valid);
  if (invalidField) {
    const label = invalidField.labels[0].textContent;
    showError(`Check ${label}. ${invalidField.validationMessage}`);
    return;
  }

  let result;
  try {
    result = calculateSalt({
      filingStatus,
      magi: fields.magi.valueAsNumber,
      incomeTaxes: fields.incomeTaxes.valueAsNumber,
      propertyTaxes: fields.propertyTaxes.valueAsNumber,
      mortgageInterest: fields.mortgageInterest.valueAsNumber,
      charitableDeduction: fields.charitableDeduction.valueAsNumber,
      marginalRate: Number(fields.marginalRate.value),
      magiReduction: fields.magiReduction.valueAsNumber,
      spouseItemizes: fields.spouseItemizes.checked
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    showError(problem.message);
    return;
  }

  const { rescue, standardAvailable } = result;
  const { floor, phaseRate } = SALT_PARAMETERS[filingStatus];
  const values = {
    verdict: standardAvailable ? verdicts[result.verdict] : 'Itemizing is required when your spouse itemizes separately.',
    'salt-cap': dollars.format(result.saltCap),
    'allowable-salt': dollars.format(result.allowableSalt),
    itemized: dollars.format(result.itemized),
    standard: standardAvailable ? dollars.format(result.standardDeduction) : 'Unavailable',
    'old-cap-label': `Estimated tax saved vs. old ${wholeDollars.format(floor)} cap`,
    'old-cap-savings': dollars.format(result.taxSavedVsOldCap),
    'effective-rate': percent.format(result.effectiveMarginalRate / 100),
    'rate-note': result.torpedoActive
      ? `At these inputs, another $1 of MAGI can reduce the deduction by ${dollars.format(phaseRate)}.`
      : 'The SALT phase-down adds no marginal tax at these inputs.',
    'rescue-scenario': `After the pre-tax reduction, estimated MAGI is ${dollars.format(rescue.scenarioMagi)} and the SALT cap is ${dollars.format(rescue.saltCap)}.`,
    'salt-restored': dollars.format(rescue.saltRestored),
    'rescue-salt-tax': dollars.format(rescue.saltTaxSavings),
    'rescue-tax': dollars.format(rescue.totalTaxSavings),
    'to-full-cap': dollars.format(rescue.toFullCap)
  };
  for (const [id, value] of Object.entries(values)) {
    const element = document.getElementById(id);
    if (element.textContent !== value) element.textContent = value;
  }
  error.hidden = true;
  estimate.hidden = false;
}

function showError(message) {
  estimate.hidden = true;
  error.textContent = message;
  error.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
