import { calculateAttribution } from './model.mjs';

const element = (id) => document.getElementById(id);
const form = element('scenario');
const rows = element('other-contributions');
const addButton = element('add-contribution');
const results = element('results');
const errorBox = element('scenario-error');
const datePresets = [...form.querySelectorAll('[data-date]')];

const formatCurrency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const formatDate = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
});
const money = (amount) => formatCurrency.format(amount);
const number = (id) => element(id).valueAsNumber;

function showText(id, text) {
  const target = element(id);
  if (target.textContent !== text) target.textContent = text;
}

function update() {
  const contributionDate = element('contribution-date').value;
  const rrif = element('rrif').checked;
  element('rrif-options').hidden = !rrif;
  element('rrif-minimum').disabled = !rrif;
  for (const button of datePresets) {
    button.setAttribute('aria-pressed', String(button.dataset.date === contributionDate));
  }

  let result;
  try {
    result = calculateAttribution({
      contributionDate,
      contributionAmount: number('contribution-amount'),
      availableRoom: number('deduction-room'),
      contributorRate: number('contributor-rate'),
      spouseRate: number('spouse-rate'),
      withdrawalDate: element('withdrawal-date').value,
      withdrawalAmount: number('withdrawal-amount'),
      rrif,
      rrifMinimum: number('rrif-minimum'),
      otherContributions: Array.from(rows.children, (row) => {
        const [date, amount] = row.querySelectorAll('input');
        return { date: date.value, amount: amount.valueAsNumber };
      }),
    });
  } catch (error) {
    results.hidden = true;
    errorBox.hidden = false;
    showText('scenario-error', error.message);
    return;
  }

  errorBox.hidden = true;
  results.hidden = false;
  element('attribution-status').dataset.state = result.status;
  const labels = {
    attributed: 'ATTRIBUTED — Clawed back to contributor',
    safe: 'SAFE — Taxed to spouse',
    'no-withdrawal': 'No withdrawal entered',
  };
  showText('status-label', labels[result.status]);
  const [firstYear, , lastYear] = result.lookbackYears;
  const windowText = `CRA lookback: ${firstYear}–${lastYear}.`;
  showText('status-details', result.rrifExemptAmount > 0 ?
    `${windowText} ${money(result.rrifExemptAmount)} is covered by the RRIF minimum.` : windowText);

  showText('earliest-date', result.earliestDate ?
    formatDate.format(new Date(`${result.earliestDate}T00:00:00Z`)) : 'No contribution entered');
  showText('deduction-benefit', result.deductionBenefit === null ? 'Outside this estimate' : money(result.deductionBenefit));
  showText('contributor-income', money(result.contributorIncome));
  showText('spouse-income', money(result.spouseIncome));
  showText('splitting-savings', money(result.splittingSavings));
  showText('extra-tax', money(result.extraTax));
  showText('withdrawal-tax', money(result.withdrawalTax));
  element('rrif-result').hidden = !rrif;
  showText('exempt-amount', money(result.rrifExemptAmount));

  const deductionNote = result.deductibleAmount === null ?
    'The refund estimate covers new contributions from March 3, 2026 through March 1, 2027.' :
    `2026 deduction modelled on ${money(result.deductibleAmount)}.`;
  showText('deduction-note', result.first60Days ?
    `${deductionNote} The contribution counts in calendar year 2027 for attribution.` : deductionNote);
  element('room-warning').hidden = !(result.aboveRoom > 0);
  if (result.aboveRoom > 0) {
    showText('room-warning', `${money(result.aboveRoom)} is above the 2026 deduction room you entered. Check actual contribution room before depositing.`);
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('change', update);

for (const button of datePresets) {
  button.addEventListener('click', () => {
    element('contribution-date').value = button.dataset.date;
    update();
  });
}

addButton.addEventListener('click', () => {
  const row = element('contribution-template').content.firstElementChild.cloneNode(true);
  row.querySelector('input[type="date"]').value = element('contribution-date').value;
  row.querySelector('input[type="number"]').value = '0';
  row.querySelector('button').addEventListener('click', () => {
    const nextFocus = row.nextElementSibling?.querySelector('button') ?? addButton;
    row.remove();
    nextFocus.focus();
    update();
  });
  rows.append(row);
  row.querySelector('input').focus();
  update();
});

update();
