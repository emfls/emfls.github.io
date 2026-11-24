import { comparePlans } from './model.mjs';

const form = document.querySelector('#resp-form');
const error = document.querySelector('#error');
const results = document.querySelector('#results');
const detailPlan = document.querySelector('#detail-plan');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const signed = amount => amount > 0 ? '+' + money.format(amount) : money.format(amount);
const planNames = { current: 'Your plan', grant: 'Grant-focused', hybrid: 'Hybrid front-load', lump: 'Day-one lump sum' };
let projection;

function addRow(parent, label, values) {
  const row = parent.insertRow();
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);
  for (const value of values) row.insertCell().textContent = value;
}

function renderSchedule() {
  const table = document.querySelector('#schedule');
  table.replaceChildren();
  const plan = projection.plans[detailPlan.value];
  for (const year of plan.years) {
    addRow(table, String(year.age), [year.contribution, year.basic, year.additional, year.clb, year.balance].map(money.format));
  }
}

function render() {
  try {
    const values = {};
    for (const input of form.querySelectorAll('input[type="number"]')) {
      if (input.validity.badInput || !input.checkValidity()) {
        throw new RangeError(`Check ${input.labels[0].textContent.toLowerCase()}. ${input.validationMessage}`);
      }
      if (input.value !== '') values[input.name] = input.valueAsNumber;
    }
    projection = comparePlans(values);
  } catch (problem) {
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }
  error.hidden = true;
  const { plans, openingBalance, remainingContribution, clbEligible, extraRate, hybridVsLump } = projection;
  const { current, hybrid, lump } = plans;
  const highest = Object.entries(plans).reduce((leader, entry) => entry[1].balance > leader[1].balance ? entry : leader);
  document.querySelector('#current-balance').textContent = money.format(current.balance);
  document.querySelector('#current-grants').textContent = money.format(current.grants);
  document.querySelector('#largest-fund').textContent = money.format(highest[1].balance);
  document.querySelector('#largest-plan').textContent = planNames[highest[0]];
  const clbText = clbEligible === null ? 'CLB income eligibility needs confirmation for 17+ children. Only entered arrears are included.'
    : `The entered income ${clbEligible ? 'meets' : 'exceeds'} the CLB income threshold.`;
  document.querySelector('#eligibility').textContent =
    `Opening balance ${money.format(openingBalance)} · RESP room ${money.format(remainingContribution)} · Additional CESG rate ${extraRate * 100}%. ${clbText}`;
  const gap = hybrid.basic + hybrid.additional - lump.basic - lump.additional;
  const gapNote = gap >= 0 ? `${money.format(gap)} more CESG` : `${money.format(-gap)} less CESG`;
  document.querySelector('#lump-comparison').textContent =
    `Hybrid vs. day-one lump sum: ${signed(hybridVsLump)} at age 18 and ${gapNote}. Compare personal deposits below.`;
  const warning = document.querySelector('#penalty');
  warning.hidden = current.excess === 0;
  if (!warning.hidden) {
    warning.textContent = `Your plan would leave up to ${money.format(current.excess)} over the lifetime limit if all planned deposits were made and the excess stayed in the RESP. At 1% per month, that is up to ${money.format(current.monthlyPenalty)} per month across subscribers. The projection excludes ${money.format(current.refused)} of future deposits above the cap and shows the fund before any penalty tax.`;
  }

  const table = document.querySelector('#comparison');
  table.replaceChildren();
  for (const [label, key] of [
    ['Fund at age 18', 'balance'], ['Extra fund vs. your plan', 'extraVsCurrent'],
    ['New personal deposits', 'contributions'], ['Lifetime personal deposits', 'lifetimeContributions'],
    ['Basic CESG', 'basic'], ['Additional CESG', 'additional'], ['Canada Learning Bond', 'clb'],
    ['Total new federal incentives', 'grants'],
  ]) {
    addRow(table, label, Object.values(plans).map(plan => key === 'extraVsCurrent' ? signed(plan[key]) : money.format(plan[key])));
  }
  renderSchedule();
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
detailPlan.addEventListener('change', renderSchedule);
render();
