import { calculateScenario } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const history = byId('pension-history');
const priorInputs = byId('prior-inputs');
const results = byId('results');
const projection = byId('projection');
const error = byId('calculation-error');
const excess = byId('excess-summary');
const rows = byId('projection-rows');

const dollarFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const paymentFormat = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (amount, formatter = dollarFormat) => `A$${formatter.format(amount)}`;
const readNumber = (id) => byId(id).valueAsNumber;

function renderProjection(records) {
  const fragment = document.createDocumentFragment();
  for (const [i, row] of records.entries()) {
    const tr = document.createElement('tr');
    if (i > 0 && row.rate !== records[i - 1].rate) tr.className = 'rate-change';

    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = `${row.year}–${String(row.year + 1).slice(-2)}`;
    tr.append(year);
    for (const value of [row.age, `${row.rate}%`, money(row.opening), money(row.annual), money(row.closing)]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      tr.append(cell);
    }
    fragment.append(tr);
  }
  rows.replaceChildren(fragment);
}

function update() {
  const firstTime = history.value === 'first';
  priorInputs.hidden = firstTime;
  priorInputs.disabled = firstTime;

  const age = readNumber('age');
  let scenario;
  try {
    for (const field of form.querySelectorAll('input[type="number"]')) {
      if (field.willValidate && !field.validity.valid) {
        const label = field.labels[0].textContent;
        throw new RangeError(`Check “${label}”. ${field.validationMessage}`);
      }
    }
    scenario = calculateScenario({
      firstTime,
      age,
      totalSuper: readNumber('total-super'),
      annualReturn: readNumber('annual-return'),
      personalCapBeforeJul2026: readNumber('prior-cap'),
      highestEverTBA: readNumber('highest-tba'),
      personalCapAtPeak: readNumber('peak-cap'),
      currentTBA: readNumber('current-tba'),
      pensionBeforeTransfer: readNumber('existing-pension'),
      everReachedCap: byId('reached-cap').value === 'yes',
      addTransfer: byId('add-transfer').checked,
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    projection.hidden = true;
    error.textContent = issue.message;
    error.hidden = false;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  byId('annual-minimum').textContent = `${money(scenario.annual)} · ${scenario.rate}%`;
  byId('monthly').textContent = money(scenario.monthly, paymentFormat);
  byId('fortnightly').textContent = money(scenario.fortnightly, paymentFormat);
  byId('personal-cap').textContent = money(scenario.personalCap);
  byId('pension-balance').textContent = money(scenario.pension);
  byId('accumulation-balance').textContent = money(scenario.accumulation);

  const transfer = `Estimated cap space before transfer: ${money(scenario.availableCap)}. Transfer included in this estimate: ${money(scenario.transfer)}.`;
  const indexation = `Unused cap percentage for indexation: ${scenario.unusedPercent}%. Cap increase: ${money(scenario.increment)}. `;
  byId('cap-summary').textContent = firstTime ? transfer : indexation + transfer;
  excess.hidden = scenario.excess === 0;
  excess.textContent = scenario.excess > 0
    ? `The entered transfer balance exceeds the indexed cap by ${money(scenario.excess)}. Check the ATO position and any required commutation. This estimate assumes no commutation.`
    : '';
  const tax = age >= 60
    ? 'Payments from a taxed super fund are generally tax-free at this age.'
    : 'Payment tax depends on the tax components and your circumstances.';
  byId('payment-note').textContent = `${tax} Averages divide the annual minimum by 12 or 26 and are rounded for display. Check the total actually paid by 30 June.`;
  renderProjection(scenario.projection);
  results.hidden = false;
  projection.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
