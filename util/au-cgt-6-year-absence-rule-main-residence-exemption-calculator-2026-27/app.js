import { compareScenarios } from './model.mjs';

const form = document.querySelector('#calculator');
const timeline = document.querySelector('#periods');
const addPeriod = document.querySelector('#add-period');
const timelineStart = document.querySelector('#timeline-start');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const savingsLabel = document.querySelector('#savings-label');
const savingsValue = document.querySelector('#tax-saved');
const comparisonRows = document.querySelectorAll('[data-field]');
const emptyChangeRow = timeline.lastElementChild.cloneNode(true);

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const integer = new Intl.NumberFormat('en-AU');
const dates = ['purchaseContract', 'purchaseSettlement', 'saleContract', 'saleSettlement'];
const amounts = [
  'purchasePrice', 'stampDuty', 'salePrice', 'sellingCosts',
  'improvements', 'postResetImprovements', 'marketValue', 'otherIncome',
];

function readInputs() {
  const input = {};
  for (const name of dates) input[name] = form.elements[name].value;
  for (const name of amounts) input[name] = form.elements[name].valueAsNumber;
  input.periods = Array.from(timeline.children, row => ({
    from: row.querySelector('[data-from]')?.value ?? input.purchaseSettlement,
    use: row.querySelector('[data-use]').value,
  }));
  return input;
}

function formatCell(field, value) {
  if (typeof value === 'boolean') return value ? 'Applies' : 'Does not apply';
  if (field.endsWith('Days')) return integer.format(value);
  return currency.format(value);
}

function render() {
  const input = readInputs();
  timelineStart.value = input.purchaseSettlement || 'Enter purchase settlement';
  try {
    const { withRule, withoutRule, taxSaved } = compareScenarios(input);
    for (const row of comparisonRows) {
      const field = row.dataset.field;
      row.cells[1].textContent = formatCell(field, withRule[field]);
      row.cells[2].textContent = formatCell(field, withoutRule[field]);
    }
    savingsLabel.textContent = taxSaved < -0.005
      ? 'Estimated extra tax from choosing the rule'
      : 'Estimated tax saved by choosing the rule';
    savingsValue.textContent = currency.format(Math.abs(taxSaved));
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.hidden = false;
    error.textContent = issue.message;
  }
}

function labelChanges() {
  Array.from(timeline.children).slice(1).forEach((row, index) => {
    const number = index + 1;
    const dateId = 'change-date-' + number;
    const useId = 'change-use-' + number;
    const dateLabel = row.querySelector('[data-date-label]');
    dateLabel.textContent = 'Change ' + number + ' date';
    dateLabel.htmlFor = dateId;
    row.querySelector('[data-from]').id = dateId;
    row.querySelector('[data-use-label]').htmlFor = useId;
    row.querySelector('[data-use]').id = useId;
    row.querySelector('[data-remove]').setAttribute('aria-label', 'Remove change ' + number);
  });
}

addPeriod.addEventListener('click', () => {
  const row = emptyChangeRow.cloneNode(true);
  const date = row.querySelector('[data-from]');
  date.value = '';
  timeline.append(row);
  labelChanges();
  date.focus();
  render();
});

timeline.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove]');
  if (!remove) return;
  const row = remove.closest('.timeline-row');
  const nextFocus = row.nextElementSibling?.querySelector('[data-from]') ?? addPeriod;
  row.remove();
  labelChanges();
  nextFocus.focus();
  render();
});

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
