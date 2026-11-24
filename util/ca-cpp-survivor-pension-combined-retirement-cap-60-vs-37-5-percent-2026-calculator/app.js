import { CLAIM_AGES, compareClaimAges } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('cpp-form');
const fields = ['currentAge', 'endAge', 'deceasedAt65', 'ownAt65'].map(byId);
const claimAge = byId('claimAge');
const results = byId('results');
const message = byId('input-error');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = (value) => currency.format(value);
const show = (id, value) => { byId(id).textContent = value; };

function render() {
  const [current, end, deceased, own] = fields;
  const currentAge = current.valueAsNumber;
  const endAge = end.valueAsNumber;
  end.min = current.validity.valid ? currentAge + 1 : 19;
  for (const field of fields) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }

  if (fields.some((field) => !field.validity.valid)) {
    results.hidden = true;
    message.hidden = false;
    show('input-error', 'Enter whole ages with an end age above the starting age, and CPP amounts from $0 to $1,507.65 in cents.');
    return;
  }

  const comparison = compareClaimAges({
    currentAge, endAge, deceasedAt65: deceased.valueAsNumber, ownAt65: own.valueAsNumber,
  });
  for (const option of claimAge.options) option.disabled = Number(option.value) < currentAge;
  const { scenarios, standaloneMonthly, bestClaimAges } = comparison;
  const selected = scenarios.find((scenario) => scenario.claimAge === Number(claimAge.value)) ?? scenarios[0];
  if (selected) claimAge.value = String(selected.claimAge);
  claimAge.disabled = !selected;

  results.hidden = false;
  message.hidden = true;
  show('input-error', '');
  show('standalone', money(standaloneMonthly));
  byId('selected-results').hidden = !selected;
  if (selected) {
    const month = selected.firstClaimMonth;
    show('selection', `First modeled payment at age ${selected.claimAge}`);
    show('combined', money(month.combinedMonthly));
    show('lost-month', money(month.reductionMonthly));
    show('lost-year', money(month.reductionAnnual));
    show('lost-20', money(selected.reductionFirst20Years));
    show('uncapped', money(month.uncappedMonthly));
    show('scenario-cap', month.capMonthly === null ? '—' : money(month.capMonthly));
  }

  show('horizon', `From age ${currentAge} to the ${endAge} birthday · CAD`);
  const rows = CLAIM_AGES.map((age) => {
    const scenario = scenarios.find(({ claimAge: start }) => start === age);
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = `Age ${age}`;
    row.append(label);
    const values = scenario
      ? [
          money(scenario.firstClaimMonth.ownMonthly),
          money(scenario.firstClaimMonth.combinedMonthly),
          money(scenario.cumulativeCombined),
          money(scenario.cumulativeReduction),
          scenario.startsBeforeEnd ? 'Starts within projection' : 'Starts at or after end age',
        ]
      : ['—', '—', '—', '—', 'Age already passed'];
    for (const value of values) row.insertCell().textContent = value;
    return row;
  });
  byId('comparison-rows').replaceChildren(...rows);

  let best = 'All three start ages have passed for this prospective comparison.';
  if (selected) {
    const total = scenarios.find(({ claimAge: age }) => age === bestClaimAges[0]).cumulativeCombined;
    if (!scenarios.some(({ startsBeforeEnd }) => startsBeforeEnd) || own.valueAsNumber === 0) {
      best = `Survivor-only total through age ${endAge}: ${money(total)}.`;
    } else {
      const ages = bestClaimAges.join(' and ');
      best = bestClaimAges.length === 1
        ? `Highest modeled total through age ${endAge}: start at ${ages} (${money(total)}).`
        : `Ages ${ages} tie for the highest modeled total through age ${endAge} (${money(total)}).`;
    }
  }
  show('best', best);
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
