import { calculateSalarySacrifice } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const breakdown = byId('breakdown');
const resultState = byId('result-state');
const errorPanel = byId('calc-error');
const pensionInput = byId('pension');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = amount => gbp.format(Math.round(amount * 100) === 0 ? 0 : amount);

function readInput() {
  const input = {};
  for (const field of form.elements) {
    if (!field.name) continue;
    field.removeAttribute('aria-invalid');
  }

  for (const field of form.elements) {
    if (!field.name) continue;
    if (!field.validity.valid) {
      field.setAttribute('aria-invalid', 'true');
      throw new RangeError(`${field.labels[0].textContent.trim()} — ${field.validationMessage}`);
    }
    const numeric = field.type === 'number' || field.type === 'range';
    input[field.name] = numeric ? field.value === '' ? 0 : field.valueAsNumber : field.value;
  }
  return input;
}

function describePch(saving) {
  if (Math.abs(saving) < 0.005) return 'Same monthly cost as private contract hire';
  const comparison = saving > 0 ? 'less' : 'more';
  return `${money(Math.abs(saving))}/mo ${comparison} than private contract hire`;
}

function describeTaper({ combined, allowanceRestored, taperBonus }) {
  if (allowanceRestored === 0) {
    return combined.adjustedNetIncome <= 100000
      ? 'Full Personal Allowance in both cases'
      : 'No change in Personal Allowance';
  }
  const action = allowanceRestored > 0 ? 'restored' : 'lost';
  const effect = taperBonus > 0 ? 'additional tax saved' : 'extra tax';
  const full = allowanceRestored > 0 && combined.adjustedNetIncome <= 100000
    ? ' · full Personal Allowance restored' : '';
  return `${money(Math.abs(allowanceRestored))} ${action} · ${money(Math.abs(taperBonus))} ${effect} within total${full}`;
}

function renderPayroll(scenarios) {
  const metrics = [
    ['Gross cash pay', 'cashPay'],
    ['Adjusted net income', 'adjustedNetIncome'],
    ['Personal Allowance', 'allowance'],
    ['Income Tax', 'tax'],
    ['Employee Class 1 NI', 'ni'],
    ['Student loan deductions', 'loan'],
    ['Take-home pay', 'takeHome']
  ];
  const rows = metrics.map(([label, key]) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const scenario of scenarios) {
      const cell = document.createElement('td');
      cell.textContent = money(scenario[key]);
      row.append(cell);
    }
    return row;
  });
  byId('payroll-rows').replaceChildren(...rows);
}

function render(estimate) {
  const { baseline, pensionOnly, current, projection, floor } = estimate;
  const values = {
    'ev-cost': money(current.evMonthlyCost),
    'pch-saving': describePch(current.pchMonthlySaving),
    'combined-saving': `${money(current.taxAndNiSaved)} (${money(current.taxSaved)} tax + ${money(current.niSaved)} NI)`,
    'bik-tax': `${money(current.bikTax)} on a ${money(current.bikValue)} taxable benefit`,
    ani: money(current.combined.adjustedNetIncome),
    'taper-effect': describeTaper(current),
    'projected-cost': `${money(projection.evMonthlyCost)}/mo`,
    'pension-sacrifice': money(estimate.pensionSacrifice),
    'ev-sacrifice': money(estimate.evAnnual),
    'employer-ni': `${money(estimate.employerClass1Saved)} saved · ${money(estimate.employerClass1A)} Class 1A due on BiK`,
    'pension-total': `${money(estimate.pensionTotal)}, including ${money(estimate.pensionTopUp)} NI share`,
    'loan-saved': `${money(current.loanSaved)} combined · ${money(current.evLoanSaved)} from EV`,
    'projected-bik': `${money(projection.bikValue)} taxable benefit · ${money(projection.bikTax)} Income Tax`
  };
  for (const [id, value] of Object.entries(values)) byId(id).textContent = value;

  const wageFloor = byId('wage-floor');
  wageFloor.dataset.below = String(floor.below);
  const status = floor.below ? 'Below minimum wage floor' : 'Meets the annualised minimum wage screen';
  wageFloor.textContent = `${status}. Cash pay ${money(floor.effectiveHourlyPay)}/hour versus ${money(floor.hourlyRate)}/hour required (${money(floor.annualMinimum)} annualised). Confirm each pay reference period with payroll.`;
  renderPayroll([baseline, pensionOnly, current.combined]);
}

function refresh() {
  byId('passback-value').textContent = `${byId('passback').value}%`;
  let estimate;
  try {
    estimate = calculateSalarySacrifice(readInput());
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    errorPanel.textContent = error.message;
    errorPanel.hidden = false;
    results.hidden = true;
    breakdown.hidden = true;
    resultState.textContent = 'Check your inputs to see the estimate.';
    resultState.hidden = false;
    return;
  }

  render(estimate);
  errorPanel.hidden = true;
  errorPanel.textContent = '';
  resultState.hidden = true;
  results.hidden = false;
  breakdown.hidden = false;
}

const pensionUnit = byId('pension-unit');
let previousUnit = pensionUnit.value;
form.addEventListener('input', () => {
  if (pensionUnit.value !== previousUnit) {
    const annualSalary = byId('salary').valueAsNumber;
    const pensionValue = pensionInput.valueAsNumber;
    if (annualSalary > 0 && Number.isFinite(pensionValue)) {
      const converted = pensionUnit.value === 'percent'
        ? pensionValue / annualSalary * 100 : pensionValue / 100 * annualSalary;
      pensionInput.value = converted.toFixed(2);
    }
    previousUnit = pensionUnit.value;
    byId('pension-hint').textContent = previousUnit === 'percent' ? 'Leave blank for 0%.' : 'Leave blank for £0.';
  }
  refresh();
});
form.addEventListener('submit', event => event.preventDefault());
refresh();
