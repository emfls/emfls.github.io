import { calculateAmt } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('amt-form');
const provinceField = byId('province');
const taxpayerField = byId('taxpayer');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const numericInputs = [...form.elements].filter(control => control.type === 'number');
const outputs = [...document.querySelectorAll('[data-result]')];
const optionalInputs = new Set(['ontarioSurtaxBase', 'quebecAti', 'quebecMinimumDeduction', 'quebecRegularTax']);
const recoveryRows = byId('recovery-rows');
const error = byId('input-error');
const money = value => value == null ? '—' : currency.format(value);

function setVisible(id, visible) {
  const group = byId(id);
  group.hidden = !visible;
  for (const input of group.querySelectorAll('input')) input.disabled = !visible;
}

function update() {
  const province = provinceField.value;
  const isTrust = taxpayerField.value === 'trust';
  setVisible('trust-note', isTrust);
  setVisible('lcge-fields', !isTrust);
  setVisible('ontario-fields', province === 'ON' && !isTrust);
  setVisible('quebec-fields', province === 'QC' && !isTrust);
  setVisible('quebec-cash', province === 'QC');

  const input = { province, isTrust };
  const invalidLabels = [];
  for (const control of numericInputs) {
    const invalid = !control.disabled && !control.validity.valid;
    control.setAttribute('aria-invalid', String(invalid));
    if (invalid) invalidLabels.push(control.labels[0].textContent);
    if (control.disabled || invalid) continue;
    if (control.value !== '') input[control.id] = control.valueAsNumber;
    else if (!optionalInputs.has(control.id)) input[control.id] = 0;
  }

  const result = invalidLabels.length === 0 ? calculateAmt(input) : null;
  error.hidden = invalidLabels.length === 0;
  error.textContent = invalidLabels.length ? `Check these amounts (from $0 to $1 billion, up to two decimal places): ${invalidLabels.join(', ')}.` : '';
  const values = result ? { ...result, ...result.carryforward } : {};
  for (const output of outputs) output.textContent = money(values[output.dataset.result]);

  byId('provincial-label').textContent = province === 'QC' ? 'Additional Quebec AMT' : 'Provincial AMT addition';
  const partial = result?.totalAdditionalAmtPayable === null;
  byId('total-label').textContent = partial ? 'Combined estimate unavailable' : 'Estimated additional AMT';
  const notes = {
    ON: input.ontarioSurtaxBase == null
      ? 'Ontario estimate includes the 24.63% basic addition. Enter the provincial surtax base to include any incremental Ontario surtax.'
      : 'Ontario estimate includes the 24.63% basic addition and any incremental provincial surtax.',
    BC: 'British Columbia applies 40% to the additional federal AMT for 2026.',
    AB: 'Alberta estimate applies the 35% multiplier from the latest available AB428.',
    QC: isTrust
      ? 'Quebec trusts use a separate provincial return. The federal cash impact assumes the 16.5% Quebec abatement applies.'
      : 'Enter the three Quebec worksheet amounts for the combined estimate. The federal cash impact includes the 16.5% Quebec abatement.',
  };
  byId('province-note').textContent = notes[province];

  const rows = (result?.carryforward.years ?? []).map(({ year, claimed, remaining }) => {
    const row = document.createElement('tr');
    const yearCell = document.createElement('th');
    yearCell.scope = 'row';
    yearCell.textContent = year;
    row.append(yearCell);
    for (const value of [claimed, remaining]) row.insertCell().textContent = money(value);
    return row;
  });
  recoveryRows.replaceChildren(...rows);
}

for (const event of ['input', 'change']) form.addEventListener(event, update);
for (const event of ['input', 'change']) byId('annualHeadroom').addEventListener(event, update);
form.addEventListener('submit', event => event.preventDefault());
update();
