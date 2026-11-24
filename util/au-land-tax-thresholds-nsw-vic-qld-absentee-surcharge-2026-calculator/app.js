import { compareLandTax, MAX_AMOUNT } from './model.mjs';

const form = document.querySelector('#land-tax-form');
const { landValue, state, owner, surcharged, propertyValue, annualRent, annualExpenses } = form.elements;
const byId = id => document.getElementById(id);
const marketInputs = [propertyValue, annualRent, annualExpenses];
const stateNames = { NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland' };
const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2,
});
const percentage = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const write = (id, value) => { byId(id).textContent = value; };

for (const input of [landValue, ...marketInputs]) input.max = String(MAX_AMOUNT);

function showError(id, message = '') {
  const error = byId(id);
  error.textContent = message;
  error.hidden = !message;
}

function update() {
  const invalidLand = !landValue.validity.valid;
  landValue.setAttribute('aria-invalid', String(invalidLand));
  byId('results').hidden = invalidLand;
  showError('land-error', invalidLand ? 'Enter a non-negative taxable land value with up to two decimal places.' : '');

  const invalidMarketInput = marketInputs.find(input => !input.validity.valid);
  for (const input of marketInputs) input.setAttribute('aria-invalid', String(!input.validity.valid));
  showError('yield-error', invalidMarketInput
    ? 'Use at least A$0.01 for market value and non-negative rent and expenses, with up to two decimal places.'
    : '');
  if (invalidLand) return;

  const yieldReady = !invalidMarketInput && marketInputs.every(input => input.value !== '');
  const rows = compareLandTax({
    landValue: landValue.valueAsNumber,
    owner: owner.value,
    surcharged: surcharged.value === 'yes',
    propertyValue: yieldReady ? propertyValue.valueAsNumber : null,
    annualRent: yieldReady ? annualRent.valueAsNumber : 0,
    annualExpenses: yieldReady ? annualExpenses.valueAsNumber : 0,
  });
  const selected = rows.find(row => row.state === state.value);
  const { trustDifference } = selected;

  write('selected-state', stateNames[selected.state]);
  write('total-tax', aud.format(selected.totalTax));
  write('base-tax', aud.format(selected.baseTax));
  write('surcharge-tax', aud.format(selected.surcharge));
  byId('status-impact-detail').hidden = surcharged.value !== 'yes';
  write('status-impact', aud.format(selected.statusImpact));
  write('trust-difference', `${trustDifference > 0 ? '+' : ''}${aud.format(trustDifference)}`);
  write('yield-before', yieldReady ? `${percentage.format(selected.netYieldBeforeTax)}%` : '—');
  write('yield-after', yieldReady ? `${percentage.format(selected.netYieldAfterTax)}%` : '—');
  write('yield-drag', yieldReady ? `${percentage.format(selected.yieldDrag)} pp` : '—');

  const ownershipLabel = owner.selectedOptions[0].textContent;
  const statusLabel = surcharged.value === 'yes' ? 'liable foreign or absentee scenario' : 'no foreign or absentee surcharge';
  write('comparison-context', `${aud.format(landValue.valueAsNumber)} taxable land value in each state · ${ownershipLabel} · ${statusLabel}`);
  byId('comparison-rows').replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    if (row === selected) tr.classList.add('is-selected');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = row.state;
    tr.append(heading);
    for (const amount of [row.baseTax, row.surcharge, row.totalTax]) {
      tr.insertCell().textContent = aud.format(amount);
    }
    return tr;
  }));

  let warning = 'The trust and personal-name bills are equal in this scenario.';
  if (trustDifference > 0) {
    warning = `Holding in a trust adds ${aud.format(trustDifference)} a year compared with holding in a personal name in ${stateNames[selected.state]}. Allow for that annual cost in your rental budget.`;
  } else if (trustDifference < 0) {
    warning = `The trust bill is ${aud.format(-trustDifference)} lower per year than the personal-name bill in this scenario. Check the applicable trust classification before budgeting.`;
  }
  write('trust-warning', warning);
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
