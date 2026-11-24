import { calculateBond, checkContribution, withdrawalTax } from './model.mjs';

const byId = (id) => document.getElementById(id);
const formatAud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol' });
const money = (value) => formatAud.format(value);
const write = (id, text) => { byId(id).textContent = text; };

function number(id) {
  const field = byId(id);
  if (!field.validity.valid || !Number.isFinite(field.valueAsNumber)) {
    const label = field.labels[0].textContent;
    throw new RangeError(`${label}: ${field.validationMessage || 'Enter a number.'}`);
  }
  return field.valueAsNumber;
}

function updateProjection() {
  const marginalRate = Number(byId('marginal-rate').value) / 100;
  const value = calculateBond({
    initialInvestment: number('initial-investment'),
    annualContribution: number('annual-contribution'),
    incomeYield: number('income-yield') / 100,
    capitalGrowth: number('capital-growth') / 100,
    bondRate: number('bond-rate') / 100,
    marginalRate,
    directFrankingRate: number('direct-franking') / 100,
    years: number('years'),
  });

  const completed = value.policyYear >= 11;
  write('bond-value-label', completed ? 'Bond value free of additional personal tax' : 'Investment bond after-tax value');
  write('bond-value', money(value.bondAfterTax));
  write('direct-value', money(value.directAfterTax));
  write('bond-tax', `Personal withdrawal top-up tax ${money(value.bondExitTax)}`);
  write('direct-tax', `Capital gains tax at sale ${money(value.directCgt)}`);
  const winner = { bond: 'Investment bond', direct: 'Direct portfolio' }[value.winner];
  write('verdict', winner ? `${winner} leads by ${money(Math.abs(value.difference))} in this scenario.` : 'Both options have the same estimated value to within a cent.');

  const paid = `Total contributed ${money(value.totalContributions)}.`;
  let clock = value.policyYear === null ? 'No premiums paid.' : `Withdrawal falls in policy year ${value.policyYear}.`;
  if (value.lastResetYear !== null) {
    clock = `10-YEAR CLOCK RESET ALERT — The projected contribution restarts the clock at the beginning of year ${value.lastResetYear}. ${clock}`;
  }
  write('projection-clock', `${clock} ${paid}`);

  write('bonus-caption', `Estimated tax on the same ${money(value.bondBonus)} bonus at each withdrawal timing.`);
  for (const year of [8, 9, 10, 11]) {
    write(`exit-tax-${year}`, money(withdrawalTax(value.bondBonus, year, marginalRate).topUpTax));
  }
}

function updateContribution() {
  const value = checkContribution(number('prior-contribution'), number('planned-contribution'));
  write('ceiling', `Safe annual ceiling ${money(value.maxSafeContribution)}.`);
  write('contribution-status', value.resets
    ? `10-YEAR CLOCK RESET ALERT — The planned total exceeds the limit by ${money(value.excessContribution)}. Check whether a separate new bond suits that excess.`
    : `The planned total is within the limit. Remaining headroom ${money(value.remainingHeadroom)}.`);
  byId('contribution-results').classList.toggle('warning', value.resets);
}

function connect(formId, resultsId, errorId, render, clear = () => {}) {
  const form = byId(formId);
  const results = byId(resultsId);
  const error = byId(errorId);
  function refresh() {
    try {
      render();
      error.hidden = true;
      error.textContent = '';
      results.hidden = false;
    } catch (issue) {
      if (!(issue instanceof RangeError)) throw issue;
      clear();
      results.hidden = true;
      error.hidden = false;
      error.textContent = issue.message;
    }
  }
  form.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    refresh();
  });
  refresh();
}

connect('projection-form', 'projection-results', 'projection-error', updateProjection, () => {
  write('bonus-caption', 'Enter valid projection inputs to estimate withdrawal tax.');
  for (const year of [8, 9, 10, 11]) write(`exit-tax-${year}`, '—');
});
connect('contribution-form', 'contribution-results', 'contribution-error', updateContribution);
