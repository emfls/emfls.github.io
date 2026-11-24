import { calculate, DEFAULTS, PARAMETERS } from './model.mjs';

const form = document.querySelector('#lease-form');
const estimate = document.querySelector('#estimate');
const status = document.querySelector('#estimate-status');
const error = document.querySelector('#input-error');
const balanceField = document.querySelector('#help-balance-field');
const rfbaWarning = document.querySelector('#rfba-warning');
const taperWarning = document.querySelector('#taper-warning');
const leaseNote = document.querySelector('#lease-note');
const amounts = Array.from(document.querySelectorAll('[data-result]'));
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol',
});
const percentage = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });

function money(value) {
  return currency.format(Math.abs(value) < 0.005 ? 0 : value).replace('$', 'A$');
}

for (const [name, value] of Object.entries(DEFAULTS)) {
  const field = form.elements.namedItem(name);
  if (typeof value === 'boolean') field.checked = value;
  else field.value = value ?? '';
}

function render() {
  const inputs = {};
  for (const [name, value] of Object.entries(DEFAULTS)) {
    const field = form.elements.namedItem(name);
    if (typeof value === 'boolean') inputs[name] = field.checked;
    else if (typeof value === 'string') inputs[name] = field.value;
    else if (value === null && field.value === '' && !field.validity.badInput) inputs[name] = null;
    else if (field instanceof HTMLSelectElement) inputs[name] = Number(field.value);
    else inputs[name] = field.valueAsNumber;
  }
  balanceField.hidden = !inputs.hasHelp;
  if (!inputs.hasHelp) inputs.helpBalance = null;

  let result;
  try {
    result = calculate(inputs);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    estimate.hidden = true;
    status.textContent = 'Update the inputs to see your estimate.';
    error.hidden = false;
    error.textContent = problem.message;
    return;
  }

  for (const output of amounts) {
    output.textContent = money(result[output.dataset.result]);
  }
  const treatments = {
    exempt: 'FBT-exempt under the selected facts.',
    standard: 'Standard FBT applies under the selected facts.',
    unverified: 'Eligibility unverified. The estimate uses standard FBT until the vehicle history is confirmed.',
  };
  let eligibility = treatments[result.treatment];
  if (inputs.vehicleType === 'phev_new') {
    eligibility = 'Standard FBT applies to new PHEV commitments from 1 April 2025.';
  } else if (result.treatment === 'exempt' && inputs.vehicleType === 'phev_grandfathered') {
    eligibility = 'FBT-exempt based on the selected continuing pre-1 April 2025 PHEV commitment.';
  }
  status.textContent = eligibility;
  rfbaWarning.textContent = `The RFBA adds ${money(result.helpRfbaIncrease)} in annual HELP repayment and ${money(result.mlsRfbaIncrease)} in annual MLS compared with the same packaged taxable income without RFBA. The comparison with buying includes the salary sacrifice too.`;
  if (result.taper) {
    const { employerFbt, annualCostIncrease, termCostIncrease } = result.taper;
    taperWarning.textContent = `Proposed 1 April 2027 taper: a new commitment would add ${money(employerFbt)} a year in employer FBT at the 15% statutory fraction. In this model, a qualifying commitment by 31 March 2027 would save ${money(annualCostIncrease)} a year and ${money(termCostIncrease)} over ${inputs.years} years in after-tax cash flow.`;
  } else if (result.treatment === 'exempt' && inputs.vehicleType !== 'phev_grandfathered') {
    taperWarning.textContent = `The proposed April 2027 taper would retain full relief for this EV through 31 March 2029 because its value is at or below ${money(PARAMETERS.proposedFullDiscountLimit)}.`;
  } else {
    taperWarning.textContent = '';
  }
  taperWarning.hidden = taperWarning.textContent === '';
  leaseNote.textContent = `Estimated LCT value ${money(result.lctValue)}. The ${percentage.format(result.residualRate)} buyout is paid from after-tax funds. Negative savings mean the lease costs more. HELP repayments are cash outflow and reduce debt.`;
  if (result.unpackaged > 0) {
    leaseNote.textContent += ` Annual salary is below the package cost, leaving ${money(result.unpackaged)} to pay from other funds in this estimate.`;
  }

  error.hidden = true;
  error.textContent = '';
  estimate.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
