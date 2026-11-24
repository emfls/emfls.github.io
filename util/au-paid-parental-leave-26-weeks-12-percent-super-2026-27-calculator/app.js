import { ATI_LIMITS, PAY_YEARS, estimate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('ppl-form');
const cohort = byId('cohort');
const payYear = byId('pay-year');
const atiYear = byId('ati-year');
const parentB = byId('parent-b');
const results = byId('results');
const error = byId('error');
const savings = byId('savings');
const unused = byId('unused');

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const money = cents => aud.format(cents / 100);
const statusText = {
  individual: 'passes the individual ATI test',
  family: 'passes the family ATI test',
  fails: 'exceeds both ATI limits',
};

function readAmount(id) {
  const input = byId(id);
  if (!input.validity.valid) {
    const label = input.labels[0].textContent;
    const parent = input.closest('fieldset').querySelector('legend').textContent;
    input.setAttribute('aria-invalid', 'true');
    throw new RangeError(`${parent} — ${label}: enter $0 to $100,000,000 with up to two decimal places.`);
  }
  return input.valueAsNumber;
}

function render(event) {
  const earlierCohort = cohort.value === '2025';
  payYear.options[1].disabled = !earlierCohort;
  atiYear.options[0].disabled = earlierCohort;
  if (payYear.selectedOptions[0].disabled) payYear.value = '2026';
  if (atiYear.selectedOptions[0].disabled) atiYear.value = '2024';
  if (event?.target === cohort && !earlierCohort) atiYear.value = '2025';

  const partnered = byId('household').value === 'couple';
  parentB.hidden = !partnered;
  parentB.disabled = !partnered;
  for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
  error.textContent = '';

  let result;
  try {
    result = estimate({
      cohort: cohort.value,
      payYear: payYear.value,
      atiYear: atiYear.value,
      partnered,
      atiA: readAmount('ati-a'),
      atiB: partnered ? readAmount('ati-b') : 0,
      incomeA: readAmount('income-a'),
      incomeB: partnered ? readAmount('income-b') : 0,
      claimA: byId('claim-a').checked,
      claimB: byId('claim-b').checked,
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    results.hidden = true;
    savings.textContent = '';
    return;
  }

  const limits = ATI_LIMITS[atiYear.value];
  const parents = [`Parent A ${statusText[result.statusA]}`];
  if (partnered) parents.push(`Parent B ${statusText[result.statusB]}`);
  byId('eligibility').textContent = `${parents.join('. ')}. ATI limits for this assessment are ${money(limits.individual * 100)} individual and ${money(limits.family * 100)} family.`;
  unused.hidden = result.unclaimedDays === 0;
  unused.textContent = `${result.unclaimedDays} paid days unused, worth ${money(result.unclaimedDays * PAY_YEARS[payYear.value].dayCents)} in gross pay.`;
  byId('allocation-label').textContent = partnered ? 'Paid days (A / B)' : 'Paid days';
  for (const [column, allocation] of [['default', result.baseline], ['optimal', result.optimal]]) {
    for (const cell of results.querySelectorAll(`[data-${column}]`)) {
      const key = cell.dataset[column];
      cell.textContent = key === 'days'
        ? (partnered ? allocation.days.join(' / ') : allocation.days[0])
        : money(allocation[key]);
    }
  }
  results.hidden = false;
  savings.textContent = `Estimated tax saved versus default split: ${money(result.taxSaved)}`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
