import { estimateOas, OAS_THRESHOLD, optimizeSplit } from './model.mjs';

const el = id => document.getElementById(id);
const form = el('pension-form');
const amount = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 });
const money = value => amount.format(Math.abs(value) < 0.005 ? 0 : value);
const pct = value => `${percent.format(value)}%`;
const put = (id, value) => { el(id).textContent = value; };

function inputNumber(id) {
  const input = el(id);
  if (!input.validity.valid) {
    throw new RangeError(`${input.labels[0].textContent}: ${input.validationMessage}`);
  }
  return input.valueAsNumber;
}

function syncControls(changed) {
  for (const role of ['from', 'to']) {
    const age = el(`${role}-age`);
    const toggle = el(`${role}-has-oas`);
    const oas = el(`${role}-oas`);
    if (changed === oas) oas.dataset.custom = 'true';
    if (age.validity.valid) {
      toggle.disabled = age.valueAsNumber < 65;
      if (toggle.disabled) toggle.checked = false;
      if (changed === age && !oas.dataset.custom && !toggle.disabled) {
        oas.value = estimateOas(age.valueAsNumber);
      }
    }
    oas.disabled = !toggle.checked;
    el(`${role}-oas-field`).hidden = oas.disabled;
  }
  el('manual').disabled = el('auto').checked;
  el('manual-field').hidden = el('auto').checked;
}

function readSpouse(role) {
  return {
    age: inputNumber(`${role}-age`),
    other: inputNumber(`${role}-other`),
    oas: el(`${role}-has-oas`).checked ? inputNumber(`${role}-oas`) : 0,
  };
}

function thresholdDistance(income) {
  const difference = income - OAS_THRESHOLD;
  if (Math.abs(difference) < 0.005) return 'At threshold';
  return `${money(Math.abs(difference))} ${difference > 0 ? 'above' : 'below'}`;
}

function showIndividual(baseline, selected) {
  const rows = [];
  const measures = [
    ['Net income for OAS', person => money(person.netBeforeRecovery)],
    [`Distance from ${money(OAS_THRESHOLD).replace('.00', '')}`, person => thresholdDistance(person.netBeforeRecovery)],
    ['OAS recovery', person => money(person.oasRecovery)],
    ['Federal age amount', person => money(person.federalAgeAmount)],
    ['Federal pension amount', person => money(person.federalPensionAmount)],
  ];
  for (const [role, title] of [['transferor', 'Transferring spouse'], ['recipient', 'Receiving spouse']]) {
    const heading = document.createElement('tr');
    const label = document.createElement('th');
    label.colSpan = 3;
    label.textContent = title;
    heading.append(label);
    rows.push(heading);
    for (const [name, format] of measures) {
      const row = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = name;
      row.append(th);
      row.insertCell().textContent = format(baseline[role]);
      row.insertCell().textContent = format(selected[role]);
      rows.push(row);
    }
  }
  el('individual-results').replaceChildren(...rows);
}

function showResults({ eligible, baseline, selected, optimal, savings }, automatic) {
  const summary = eligible === 0
    ? 'No eligible pension is available to split at these inputs.'
    : `${money(eligible)} of eligible pension. ${automatic
      ? 'Best of the 51 whole-percent options.'
      : `Best whole-percent option: ${pct(optimal.splitPct)} for ${money(baseline.total - optimal.total)} in annual savings.`}`;
  put('result-summary', `${summary} Selected split: ${pct(selected.splitPct)}. Annual savings: ${money(savings.annual)}.`);
  put('split-label', automatic ? 'Optimal T1032 split' : 'Manual T1032 split');
  put('split', pct(selected.splitPct));
  put('transfer', money(selected.transfer));
  put('annual', money(savings.annual));
  el('annual').classList.toggle('loss', savings.annual < -0.005);

  const qc = el('quebec-result');
  qc.hidden = selected.quebecTransfer === null;
  if (!qc.hidden) put('quebec-result', `Québec Schedule Q transfer: ${money(selected.quebecTransfer)}.`);

  const warnings = [];
  if (savings.annual < -0.005) warnings.push(`This split costs ${money(-savings.annual)} more than no split.`);
  const additionalRecovery = selected.recipient.oasRecovery - baseline.recipient.oasRecovery;
  if (additionalRecovery > 0.005) warnings.push(`The receiving spouse repays ${money(additionalRecovery)} more in OAS.`);
  el('warning-detail').hidden = warnings.length === 0;
  put('warning-detail', warnings.join(' '));

  for (const [prefix, result] of [['base', baseline], ['after', selected]]) {
    put(`${prefix}-federal`, money(result.federalTax));
    put(`${prefix}-province`, money(result.provincialTax));
    put(`${prefix}-oas`, money(result.oasRecovery));
    put(`${prefix}-total`, money(result.total));
  }
  put('saved-tax', money(savings.incomeTax));
  put('saved-oas', money(savings.oas));
  put('saved-pension', money(savings.pension));
  put('projected', money(savings.tenYear));
  showIndividual(baseline, selected);
}

function update(changed) {
  syncControls(changed);
  let result;
  const automatic = el('auto').checked;
  try {
    result = optimizeSplit({
      province: el('province').value,
      transferor: {
        ...readSpouse('from'),
        db: inputNumber('from-db'),
        rrif: inputNumber('from-rrif'),
        survivorRrif: inputNumber('from-survivor'),
      },
      recipient: readSpouse('to'),
    }, automatic ? null : inputNumber('manual'));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    el('results').hidden = true;
    el('input-error').hidden = false;
    put('input-error', error.message);
    return;
  }
  el('input-error').hidden = true;
  put('input-error', '');
  el('results').hidden = false;
  showResults(result, automatic);
}

form.addEventListener('input', event => update(event.target));
form.addEventListener('submit', event => event.preventDefault());
update();
