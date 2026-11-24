import { calculateEmployer, calculateEmployee, PAYDAY_SUPER } from './model.mjs';

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'code' });
const money = value => currency.format(Math.abs(value) < 0.005 ? 0 : value);
const employer = document.getElementById('employer');
const employee = document.getElementById('employee');

function update(form, calculate) {
  const error = form.querySelector('.error');
  const results = form.querySelector('.results');
  const invalid = Array.from(form.elements).find(field => !field.validity.valid);
  if (invalid) {
    results.hidden = true;
    error.textContent = `${invalid.labels[0].textContent.trim()}. ${invalid.validationMessage}`;
    return;
  }
  try {
    calculate(form.elements);
    error.textContent = '';
    results.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    results.hidden = true;
    error.textContent = failure.message;
  }
}

function showResults(values) {
  for (const [id, value] of Object.entries(values)) {
    document.getElementById(id).textContent = typeof value === 'number' ? money(value) : value;
  }
}

function updateEmployer() {
  const fields = employer.elements;
  const hasLateScenario = fields.daysLate.valueAsNumber > 0;
  const disclosure = fields.disclose.checked && hasLateScenario;
  document.getElementById('disclosure-field').hidden = !disclosure;
  fields.disclosureDay.disabled = !disclosure;
  update(employer, fields => {
    const result = calculateEmployer({
      annualPayroll: fields.annualPayroll.valueAsNumber,
      frequency: fields.frequency.value,
      employees: fields.employees.valueAsNumber,
      financingRate: fields.financingRate.valueAsNumber,
      daysLate: fields.daysLate.valueAsNumber,
      gicRate: fields.gicRate.valueAsNumber,
      disclosureDay: disclosure ? fields.disclosureDay.valueAsNumber : null,
      cleanHistory: fields.cleanHistory.checked
    });
    showResults({
      'pay-run-sg': result.perPayRunSg, 'annual-sg': result.annualSg,
      'average-sg': result.averageSgPerEmployee, 'float-loss': result.floatReduction,
      'financing-cost': result.annualFinancingCost, 'sg-charge': result.totalCharge,
      'unpaid-sg': result.unpaidSg, 'notional-earnings': result.notionalEarnings,
      'admin-uplift': result.uplift, 'extra-cost': result.extraCost,
      'uplift-label': hasLateScenario ? `Administrative uplift (${Math.round(result.upliftRate * 100)}%)` : 'Administrative uplift'
    });
    document.getElementById('payroll-cap-note').hidden =
      fields.annualPayroll.valueAsNumber <= fields.employees.valueAsNumber * PAYDAY_SUPER.annualContributionBase;
  });
}

function updateEmployee() {
  update(employee, fields => {
    const result = calculateEmployee({
      annualEarnings: fields.annualEarnings.valueAsNumber,
      frequency: fields.frequency.value,
      netReturn: fields.netReturn.valueAsNumber,
      years: fields.years.valueAsNumber
    });
    showResults({
      'timing-gain': result.gain,
      'gain-label': result.gain < -0.005 ? 'Lower value from earlier investment' : 'Extra value from earlier investment',
      'employee-sg': result.annualSg, 'employee-pay-run': result.annualSg / result.periodsPerYear,
      'payday-balance': result.payday.balance, 'quarterly-balance': result.quarterly.balance,
      'payday-pending': result.payday.pending, 'quarterly-pending': result.quarterly.pending
    });
    document.getElementById('employee-cap-note').hidden =
      fields.annualEarnings.valueAsNumber <= PAYDAY_SUPER.annualContributionBase;
  });
}

for (const [form, render] of [[employer, updateEmployer], [employee, updateEmployee]]) {
  form.addEventListener('input', render);
  form.addEventListener('submit', event => event.preventDefault());
  render();
}

const mode = document.getElementById('mode');
function switchMode() {
  employer.hidden = mode.value !== 'employer';
  employee.hidden = mode.value !== 'employee';
}
mode.addEventListener('change', switchMode);
switchMode();
