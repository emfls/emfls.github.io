import {
  CYCLE_QUARTERS, calculateEntryCharge, calculatePeriodicCharge,
  calculateFirstCycleExitBaseRate, calculateExitCharge, compareThirtyYears,
} from './model.mjs';

const get = id => document.getElementById(id);
const form = get('trust-calculator');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 6 });
const number = id => get(id).valueAsNumber;

function render(fields) {
  for (const [id, value] of Object.entries(fields)) {
    get(id).textContent = value;
  }
}

function fillTable(id, rows, highlightQuarter = false) {
  const fragment = document.createDocumentFragment();
  for (const [heading, ...values] of rows) {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = heading;
    row.append(label);
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    if (highlightQuarter) row.classList.toggle('selected', heading === number('exit-quarters'));
    fragment.append(row);
  }
  get(id).replaceChildren(fragment);
}

function update() {
  const invalid = form.querySelector(':invalid');
  get('results').hidden = Boolean(invalid);
  get('validation').textContent = invalid
    ? `${invalid.labels[0].textContent} — ${invalid.validationMessage}`
    : '';
  if (invalid) return;

  const entryInputs = {
    initialTrustTransfer: number('initial-transfer'),
    prior7YrCLTs: number('entry-clts'),
    settlorPays: get('entry-payer').value === 'settlor',
  };
  const entry = calculateEntryCharge(entryInputs);
  const anniversary = calculatePeriodicCharge({
    trustValueAtAnniversary: number('anniversary-value'),
    prior7YrCLTsBeforeSettlement: number('anniversary-clts'),
    capitalDistributionsLast10Yrs: number('past-exits'),
    quartersAsRelevantProperty: number('relevant-quarters'),
  });
  const firstCycle = get('exit-cycle').value === 'first';
  const exitInputs = {
    capitalDistributed: number('distribution'),
    baseRate: firstCycle
      ? calculateFirstCycleExitBaseRate(entryInputs.initialTrustTransfer, entryInputs.prior7YrCLTs)
      : anniversary.actualPeriodicRate,
    trusteesPayFromRemaining: get('exit-payer').value === 'remaining',
  };
  const selectedQuarter = number('exit-quarters');
  const exit = calculateExitCharge({ ...exitInputs, completedQuarters: selectedQuarter });
  const comparison = compareThirtyYears({ ...entryInputs, annualGrowthRate: number('annual-growth') / 100 });

  render({
    'entry-tax': money.format(entry.entryCharge),
    'entry-breakdown': `${money.format(entry.availableEntryNRB)} band remaining · ${percent.format(entry.entryRate)} on ${money.format(entry.chargeableEntry)}`,
    'anniversary-tax': money.format(anniversary.periodicCharge),
    'anniversary-rate': percent.format(anniversary.actualPeriodicRate),
    'anniversary-breakdown': `${money.format(anniversary.hypotheticalNRB)} band remaining · ${percent.format(anniversary.payablePeriodicRate)} payable after quarter relief`,
    'exit-tax': money.format(exit.exitCharge),
    'exit-breakdown': `${selectedQuarter} of ${CYCLE_QUARTERS} quarters · ${percent.format(exit.exitRate)} before any grossing`,
    'exit-rate-basis': `${firstCycle ? 'Historic settled value' : 'Anniversary value before time relief'} · ${percent.format(exitInputs.baseRate)} base rate`,
    'comparison-budget': money.format(comparison.startingBudget),
    'comparison-entry': money.format(comparison.entryCharge),
    'trust-tax': money.format(comparison.trustTax),
    'trust-drag': money.format(comparison.trustDrag),
    'trust-net': money.format(comparison.trustNet),
    'estate-gross': money.format(comparison.estateGross),
    'estate-tax': money.format(comparison.estateTax),
    'estate-net': money.format(comparison.estateNet),
    'net-difference': money.format(comparison.netDifference),
  });

  fillTable('exit-schedule', Array.from({ length: CYCLE_QUARTERS }, (_, completedQuarters) => {
    const row = calculateExitCharge({ ...exitInputs, completedQuarters });
    return [completedQuarters, percent.format(row.exitRate), money.format(row.exitCharge)];
  }), true);
  fillTable('anniversary-schedule', comparison.anniversaries.map(({ year, grossValue, tax, netValue }) =>
    [year, money.format(grossValue), money.format(tax), money.format(netValue)]));
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
