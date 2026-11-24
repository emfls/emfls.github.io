import { calculate, OAS_THRESHOLD } from './model.mjs';

const element = (id) => document.getElementById(id);
const form = element('rrif-form');
const spouseToggle = element('elect-spouse');
const spouseAge = element('spouse-age');
const openingYear = element('opening-year');
const turns65 = element('turns-65');
const estimates = element('estimates');
const projection = element('projection');
const inputError = element('input-error');
const withdrawalNote = element('withdrawal-note');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percentage = new Intl.NumberFormat('en-CA', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const money = (value) => currency.format(value);
const percent = (value) => percentage.format(value);
const displayAge = (age) => age >= 95 ? '95+' : String(age);
const number = (id) => element(id).valueAsNumber;

function showMetric(id, value, detail) {
  element(id).textContent = value;
  element(`${id}-detail`).textContent = detail;
}

function renderSchedule(rows) {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = row.year;
    tr.append(year);
    const cells = [
      displayAge(row.age), displayAge(row.factorAge), money(row.opening), money(row.minimum),
      money(row.ending), money(row.holderMinimum), money(row.holderEnding),
    ];
    for (const value of cells) tr.insertCell().textContent = value;
    fragment.append(tr);
  }
  element('projection-rows').replaceChildren(fragment);
}

function showInputError(message) {
  inputError.textContent = message;
  inputError.hidden = false;
  estimates.hidden = true;
  projection.hidden = true;
}

function update() {
  const age = number('age');
  spouseAge.disabled = !spouseToggle.checked;
  turns65.disabled = age !== 64;
  element('birthday-row').hidden = turns65.disabled;
  element('balance-label').textContent = openingYear.checked ? 'Opening RRIF value ($)' : 'January 1 RRIF value ($)';
  spouseAge.setCustomValidity('');
  if (!spouseAge.disabled && age < 95 && spouseAge.valueAsNumber >= age) {
    spouseAge.setCustomValidity('Enter a spouse or partner age below the holder’s age.');
  }

  let invalidInput = null;
  for (const input of form.querySelectorAll('input[type="number"]')) {
    const invalid = !input.disabled && !input.validity.valid;
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    if (invalid && invalidInput === null) invalidInput = input;
  }
  if (invalidInput) {
    showInputError(`${invalidInput.labels[0].textContent}. ${invalidInput.validationMessage}`);
    return;
  }

  const planned = number('planned');
  const balance = number('balance');
  const province = element('province').value;
  const result = calculate({
    balance, age, spouseAge: spouseAge.valueAsNumber, electSpouse: spouseToggle.checked,
    planned, province, otherIncome: number('other-income'), annualReturn: number('annual-return'),
    openingYear: openingYear.checked, turns65: !turns65.disabled && turns65.checked,
  });

  showMetric('minimum', money(result.minimum), openingYear.checked
    ? '0.00% in the opening year. The first minimum is due in 2027.'
    : `${percent(result.factor)} using the January 1 age of ${displayAge(result.factorAge)}.`);
  showMetric('cash', money(result.netCash), `${money(planned)} gross requested.`);
  showMetric('tax', money(result.tax.total), province === 'qc'
    ? `${percent(result.tax.rate)} on ${money(result.excess)} excess. Federal ${money(result.tax.federal)} + Québec ${money(result.tax.quebec)}.`
    : `${percent(result.tax.rate)} on ${money(result.excess)} excess.`);
  showMetric('reduction', money(result.minimumReduction), spouseToggle.checked
    ? `This year versus ${money(result.holderMinimum)} using the holder’s age.`
    : 'Select the spouse-age option to compare the two minimums.');
  showMetric('growth', money(result.extraGrowth10), spouseToggle.checked
    ? `${money(result.extraBalance10)} more remains in the RRIF at year 10, including amounts left invested by taking smaller minimums.`
    : 'Both projections use the holder’s age.');
  showMetric('pension', result.eligibleByAge ? money(result.pensionAmount) : 'Age test unmet', result.eligibleByAge
    ? 'Eligible RRIF income toward the non-refundable credit, up to $2,000 across eligible pension sources.'
    : 'The regular age test is 65 by year-end. Special survivor rules may apply.');

  const notices = [];
  if (result.shortfall > 0) {
    notices.push(`The planned amount is ${money(result.shortfall)} below the annual minimum. Cash and income estimates use your entered amount.`);
  }
  if (planned > balance) notices.push('The planned amount exceeds the entered balance. Check funds available with your carrier.');
  withdrawalNote.textContent = notices.join(' ');
  withdrawalNote.hidden = notices.length === 0;

  const threshold = money(OAS_THRESHOLD);
  let oasText = `Estimated net world income is ${money(result.incomeEstimate)}.`;
  if (result.oasRecovery === null) {
    oasText += ' The age-based OAS estimate applies from age 65.';
  } else if (result.incomeEstimate <= OAS_THRESHOLD) {
    oasText += ` That is at or below the ${threshold} threshold.`;
  } else {
    oasText += ` If you receive OAS, the 15% formula gives ${money(result.oasRecovery)} in potential recovery before the benefit cap, including ${money(result.oasFromWithdrawal)} attributable to this withdrawal before the cap. Recovery is limited to the OAS you received.`;
  }
  element('oas-result').textContent = oasText;

  renderSchedule(result.schedule);
  inputError.hidden = true;
  estimates.hidden = false;
  projection.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
