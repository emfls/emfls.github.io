import { calculateCPP } from './model.mjs';

const form = document.getElementById('cpp-form');
const business = document.getElementById('business');
const employment = document.getElementById('employment');
const province = document.getElementById('province');
const marginal = document.getElementById('marginal');
const age = document.getElementById('age');
const partialYear = document.getElementById('partial-year');
const election = document.getElementById('election');
const electionField = document.getElementById('election-field');
const status = document.getElementById('calc-status');
const qppNote = document.getElementById('qpp-note');
const results = document.getElementById('results');
const outputs = results.querySelectorAll('[data-money]');
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

const messages = {
  qpp: 'Quebec uses the Québec Pension Plan. A CPP estimate is unavailable for this selection.',
  'partial-year': 'A partial CPP year requires Schedule 8 proration. Use the CRA form to calculate your amount.',
  'age-exempt': 'Full-year CPP exemption applies for this age.',
  'election-exempt': 'A valid full-year working-beneficiary election stops CPP contributions.',
};

function render() {
  const canElect = age.validity.valid && age.valueAsNumber >= 65 && age.valueAsNumber < 70
    && province.value !== 'QC' && !partialYear.checked;
  election.disabled = !canElect;
  electionField.hidden = !canElect;
  if (!canElect) election.checked = false;

  results.hidden = true;
  qppNote.hidden = province.value !== 'QC';
  const invalid = Array.from(form.elements).find((input) => input.willValidate && !input.validity.valid);
  if (invalid) {
    status.textContent = `${invalid.labels[0].textContent}: ${invalid.validationMessage}`;
    return;
  }

  const estimate = calculateCPP({
    netBusinessIncome: business.valueAsNumber,
    t4PensionableEarnings: employment.value === '' ? 0 : employment.valueAsNumber,
    province: province.value,
    marginalTaxRate: marginal.valueAsNumber,
    age: age.valueAsNumber,
    electedOut: election.checked,
    partialYear: partialYear.checked,
  });
  status.textContent = messages[estimate.status] ?? (employment.valueAsNumber > 0
    ? 'T4 estimate assumes standard payroll withholding.'
    : 'Full-year estimate for self-employment only.');
  if (estimate.total === undefined) return;

  for (const output of outputs) {
    output.textContent = cad.format(estimate[output.dataset.money]);
  }
  results.hidden = false;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
