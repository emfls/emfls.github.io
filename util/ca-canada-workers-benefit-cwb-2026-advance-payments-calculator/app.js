import { buildBenefitCurve, calculateCwb } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('cwb-form');
const household = byId('household');
const spouseFields = byId('spouse-fields');
const dtcCount = byId('dtc-count');
const dtcPerson = byId('dtc-person');
const dtcPersonField = byId('dtc-person-field');
const dependantField = byId('couple-dependant');
const message = byId('calculation-message');
const incomeInputs = [...form.querySelectorAll('input[type="number"]')];
const [primaryWork, primaryNet, spouseWork, spouseNet] = incomeInputs;
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const householdLabels = { single: 'Single worker', couple: 'Couple', single_parent: 'Single parent' };
let currentCurve;

function syncHousehold() {
  const couple = household.value === 'couple';
  spouseFields.hidden = !couple;
  spouseWork.disabled = spouseNet.disabled = !couple;
  dependantField.hidden = !couple;
  byId('dependant').disabled = !couple;
  if (!couple && dtcCount.value === '2') dtcCount.value = '1';
  dtcCount.options[2].disabled = !couple;
  dtcCount.options[2].hidden = !couple;
  dtcPersonField.hidden = !couple || dtcCount.value !== '1';
  dtcPerson.disabled = dtcPersonField.hidden;

  if (dtcCount.value === '0') return 'none';
  if (dtcCount.value === '2') return 'both';
  return dtcPerson.disabled ? 'primary' : dtcPerson.value;
}

function renderCurve(config) {
  const key = `${config.household}:${config.dtc}`;
  if (currentCurve === key) return;
  const rows = buildBenefitCurve(config);
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const [index, value] of [row.income, row.adjustedNet, row.basic, row.supplement, row.annualTotal].entries()) {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = money.format(value);
      tr.append(cell);
    }
    fragment.append(tr);
  }
  byId('curve-body').replaceChildren(fragment);
  const people = { none: 'no DTC supplement', primary: '1 DTC claimant', spouse: '1 DTC claimant', both: '2 DTC claimants' };
  byId('curve-caption').textContent = `${householdLabels[config.household]} · ${people[config.dtc]} (CAD)`;
  currentCurve = key;
}

function renderEstimate(result) {
  const readouts = {
    annual: result?.annualTotal,
    basic: result?.basic,
    supplement: result?.supplement,
    'adjusted-net': result?.adjustedNet,
    exemption: result?.secondaryExemption,
    boost: result?.exemptionBoost,
    july: result?.installment,
    october: result?.installment,
    january: result?.installment,
    'advance-total': result?.advanceTotal,
    'filing-balance': result?.taxTimeBalance,
  };
  for (const [id, amount] of Object.entries(readouts)) {
    byId(id).textContent = amount === undefined ? '—' : money.format(amount);
  }
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function refresh() {
  const dtc = syncHousehold();
  const config = { household: household.value, dtc };
  renderCurve(config);

  const invalid = incomeInputs.filter((input) => {
    const failed = !input.disabled && !input.validity.valid;
    if (failed) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return failed;
  });
  if (invalid.length) {
    renderEstimate(undefined);
    showMessage('Enter a number in each visible income field. Working income must be zero or more.');
    return;
  }

  let result;
  try {
    result = calculateCwb({
      ...config,
      primaryWork: primaryWork.valueAsNumber,
      primaryNet: primaryNet.valueAsNumber,
      spouseWork: spouseWork.valueAsNumber,
      spouseNet: spouseNet.valueAsNumber,
      fullTimeStudent: byId('student').checked,
      hasEligibleDependant: byId('dependant').checked,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    renderEstimate(undefined);
    showMessage(error.message);
    return;
  }

  renderEstimate(result.eligible ? result : undefined);
  showMessage(result.eligible ? '' : 'A full-time student without an eligible dependant generally cannot claim CWB. If the other spouse qualifies separately, check their eligibility using CRA Schedule 6.');
}

form.addEventListener('input', refresh);
form.addEventListener('submit', (event) => event.preventDefault());
refresh();
