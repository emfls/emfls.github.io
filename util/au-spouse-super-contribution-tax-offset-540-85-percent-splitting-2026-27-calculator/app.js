import { RULES, calculateOffset, calculateSplit, projectBalances } from './model.mjs';

const byId = id => document.getElementById(id);
const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const money = amount => aud.format(amount);
const write = (id, value) => { byId(id).textContent = value; };
const statuses = { below: 'Below', at: 'At threshold', above: 'Above' };

const offsetForm = byId('offset-form');
const splitForm = byId('split-form');
const projectionForm = byId('projection-form');

function read(form) {
  const values = {};
  for (const control of form.elements) {
    if (!control.validity.valid) {
      throw new RangeError(`${control.labels[0].textContent} — ${control.validationMessage}`);
    }
    values[control.name] = control.type === 'number' ? control.valueAsNumber : control.value === 'yes';
  }
  return values;
}

function showSection(section, calculate) {
  const output = byId(`${section}-result`);
  try {
    calculate();
    write(`${section}-error`, '');
    output.hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    output.hidden = true;
    write(`${section}-error`, error.message);
  }
}

function writeList(id, messages) {
  const items = messages.map(message => {
    const item = document.createElement('li');
    item.textContent = message;
    return item;
  });
  byId(id).replaceChildren(...items);
}

function renderOffset() {
  showSection('offset', () => {
    const result = calculateOffset(read(offsetForm));
    write('tax-offset', money(result.taxOffset));
    write('offset-percent', result.offsetPercent === null ? 'N/A' : `${result.offsetPercent.toFixed(2)}%`);
    write('qualifying-contribution', money(result.qualifyingContrib));
    write('offset-income', `Spouse income for the offset is ${money(result.spouseIncome)}. The income-adjusted contribution base is ${money(result.maxEligibleContribBase)}.`);
    writeList('offset-reasons', result.reasons);
  });
}

function renderSplit() {
  showSection('split', () => {
    const inputs = read(splitForm);
    const result = calculateSplit(inputs);
    const notes = [];
    if (!result.ageEligible) notes.push('Age 65 or older, or retired at ages 60–64. The spouse cannot receive a split.');
    if (!inputs.fundAllows) notes.push('A split requires a fund that offers it and approves the application.');
    if (result.carryForwardUsed > 0) notes.push(`Carry-forward cap applied: ${money(result.carryForwardUsed)}.`);
    if (inputs.unusedCap > 0 && inputs.priorBalance >= RULES.carryForwardBalanceLimit) {
      notes.push('Carry-forward requires the sender’s prior 30 June balance to be below A$500,000.');
    }
    if (result.excessConcessional > 0) notes.push(`${money(result.excessConcessional)} exceeds the applicable cap and may attract extra tax.`);
    notes.push('All original contributions count toward the sender’s cap only. The transfer is a rollover for the recipient.');
    write('maximum-split', money(result.maxSplittableAmount));
    write('net-contributions', money(result.netAfter15PctTax));
    write('applicable-cap', money(result.applicableCap));
    writeList('split-notes', notes);
  });
}

function renderProjection() {
  showSection('projection', () => {
    let splitInputs;
    try {
      splitInputs = read(splitForm);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new RangeError('Complete the contribution splitting inputs above to update the balance projection.');
    }
    const scenario = read(projectionForm);
    const result = projectBalances(splitInputs, scenario);
    for (const partner of ['sender', 'recipient']) {
      const balance = result[partner];
      write(`${partner}-with`, money(balance.withSplit));
      write(`${partner}-without`, money(balance.withoutSplit));
      write(`${partner}-tbc`, statuses[balance.tbcStatus]);
      write(`${partner}-div296`, statuses[balance.div296Status]);
    }
    const years = result.yearsWithSplit;
    const timing = years === 1 ? '1 year' : `${years} years`;
    const laterExcess = scenario.years > 1 && splitInputs.gross > RULES.concessionalCap;
    write('split-total', `Total transferred: ${money(result.totalSplit)} across ${timing} with a split.`
      + (laterExcess ? ' Repeated gross contributions exceed the projected standard cap after year one. Extra tax is excluded.' : ''));
  });
}

offsetForm.addEventListener('input', renderOffset);
splitForm.addEventListener('input', () => {
  renderSplit();
  renderProjection();
});
projectionForm.addEventListener('input', renderProjection);
for (const form of [offsetForm, splitForm, projectionForm]) {
  form.addEventListener('submit', event => event.preventDefault());
}
renderOffset();
renderSplit();
renderProjection();
