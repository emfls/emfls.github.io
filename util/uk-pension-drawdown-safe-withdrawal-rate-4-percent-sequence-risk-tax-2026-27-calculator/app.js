import { compareDrawdown, PARAMETERS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('pension-form');
const results = byId('projection');
const error = byId('input-error');

const pounds = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
});
const poundsExact = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
});
const money = value => pounds.format(value);
const put = (id, value) => { byId(id).textContent = value; };
const numberInput = id => byId(id).valueAsNumber;

function readInputs() {
  return {
    startingPot: numberInput('starting-pot'),
    targetSpending: numberInput('target-spending'),
    retirementAge: numberInput('retirement-age'),
    statePensionAge: Number(byId('pension-age').value),
    realReturn: numberInput('real-return') / 100,
    strategy: byId('strategy').value,
    couple: byId('couple').checked,
    stressTest: byId('stress-test').checked,
  };
}

function annualFunding(amount, pot) {
  return `${money(amount)}/yr · ${pot > 0 ? percent.format(amount / pot) : 'rate N/A'}`;
}

function renderFunding(prefix, row, startingPot) {
  const required = row.requiredPension + row.cashUsed;
  put(`${prefix}-withdrawal`, annualFunding(required, startingPot));

  const details = [
    `Age ${row.age}`,
    `${money(row.pensionWithdrawal)} from SIPP`,
  ];
  if (row.cashUsed > 0) details.push(`${money(row.cashUsed)} from upfront cash`);
  if (row.statePension > 0) details.push(`${poundsExact.format(row.statePension)} State Pension`);
  if (row.shortfall >= 0.01) details.push(`${money(row.shortfall)} net shortfall`);
  put(`${prefix}-detail`, details.join(' · '));
}

function renderOutcome(prefix, scenario) {
  const age = value => value === null ? `None before ${PARAMETERS.horizon}` : String(value);
  put(`${prefix}-sipp`, scenario ? age(scenario.sippDepletionAge) : 'Off');
  put(`${prefix}-depletion`, scenario ? age(scenario.depletionAge) : 'Off');
  put(`${prefix}-shortfall`, scenario ? age(scenario.firstShortfallAge) : 'Off');
  put(`${prefix}-estate`, scenario ? money(scenario.estateAt90) : 'Off');
}

function renderSchedule(rows, statePensionAge) {
  const tableRows = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.age === statePensionAge) tr.className = 'pension-start';
    const ageCell = document.createElement('th');
    ageCell.scope = 'row';
    ageCell.textContent = row.age;
    tr.append(ageCell);
    for (const value of [row.statePension, row.pensionWithdrawal, row.cashUsed, row.tax,
      row.netIncome, row.shortfall, row.portfolioEnd]) {
      const cell = document.createElement('td');
      cell.textContent = money(value);
      tr.append(cell);
    }
    tableRows.append(tr);
  }
  byId('schedule').replaceChildren(tableRows);
}

function render(inputs, { baseline, stress, phased, upfront, taxSaved, postPensionCeiling }) {
  const { startingPot, retirementAge, statePensionAge } = inputs;
  const bridgeYears = statePensionAge - retirementAge;
  if (bridgeYears > 0) {
    renderFunding('bridge', baseline.rows[0], startingPot);
    byId('bridge-detail').textContent += ` · ${bridgeYears} bridge years · 4% benchmark ${money(startingPot * 0.04)}`;
  } else {
    put('bridge-withdrawal', 'No bridge period');
    put('bridge-detail', 'State Pension starts in the first retirement year.');
  }
  renderFunding('post', baseline.rows[bridgeYears], startingPot);

  if (postPensionCeiling) {
    put('post-ceiling', `${money(Math.floor(postPensionCeiling.netSpending))} net/yr`);
    put('ceiling-detail', `${annualFunding(postPensionCeiling.grossWithdrawal, startingPot)} gross funding in the first State Pension year, through age ${PARAMETERS.horizon} in the baseline.`);
  } else {
    put('post-ceiling', 'Bridge underfunded');
    put('ceiling-detail', 'The baseline has a spending shortfall before State Pension starts.');
  }

  put('tax-saved', taxSaved < -0.005 ? `${money(-taxSaved)} more tax` : `${money(Math.max(0, taxSaved))} saved`);
  put('tax-detail', `Phased ${money(phased.totalTax)} · Upfront ${money(upfront.totalTax)} · Upfront cash at retirement ${money(upfront.initialCash)}`);
  renderOutcome('base', baseline);
  renderOutcome('crash', stress);
  renderSchedule(baseline.rows, statePensionAge);

  const status = baseline.firstShortfallAge === null
    ? `Baseline meets planned spending to the ${PARAMETERS.horizon}th birthday.`
    : `Baseline first falls short of planned spending at age ${baseline.firstShortfallAge}.`;
  const crashStatus = stress && (stress.firstShortfallAge === null
    ? ` Early crash meets planned spending to the ${PARAMETERS.horizon}th birthday.`
    : ` Early crash first falls short at age ${stress.firstShortfallAge}.`);
  put('projection-status', status + (crashStatus || ''));
}

function calculate() {
  const inputs = readInputs();
  let comparison;
  try {
    comparison = compareDrawdown(inputs);
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.textContent = issue.message;
    error.hidden = false;
    return;
  }
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  render(inputs, comparison);
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});
calculate();
