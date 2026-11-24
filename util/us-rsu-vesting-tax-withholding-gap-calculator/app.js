import { calculateVesting, FILING, STATE_PRESETS } from './model.mjs';

const form = document.getElementById('rsu-form');
const error = document.getElementById('input-error');
const results = document.getElementById('results');
const resultStatus = document.getElementById('result-status');
const fields = form.elements;
const numberFields = [...form.querySelectorAll('input[type="number"]')];
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const integers = new Intl.NumberFormat('en-US');
const dollars = value => currency.format(value);

const taxLabels = {
  federal: 'Regular federal income tax',
  social: 'Social Security',
  medicare: 'Regular Medicare',
  additionalMedicare: 'Additional Medicare Tax',
  state: 'State income tax',
  statePayroll: 'California SDI'
};

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function toggleInput(containerId, input, show) {
  document.getElementById(containerId).hidden = !show;
  input.disabled = !show;
}

let previousDeduction = FILING[fields.filing.value].deduction;
function syncFiling() {
  const filing = fields.filing.value;
  const { deduction, caDeduction } = FILING[filing];
  if (fields.deduction.valueAsNumber === previousDeduction) fields.deduction.value = deduction;
  previousDeduction = deduction;
  fields.deduction.placeholder = deduction;
  fields.caDeduction.placeholder = caDeduction;
  toggleInput('spouse-fields', fields.spouseIncome, filing === 'mfj');
}

function syncState(resetRates = false) {
  const state = fields.state.value;
  const preset = STATE_PRESETS[state];
  if (resetRates) {
    fields.stateWithholdingRate.value = '';
    fields.stateTaxRate.value = '';
  }
  fields.stateWithholdingRate.placeholder = preset.withholding.toFixed(2);
  fields.stateTaxRate.placeholder = preset.tax === null ? 'California tax schedule' : preset.tax.toFixed(2);
  toggleInput('ca-deduction-fields', fields.caDeduction, state === 'CA' && fields.stateTaxRate.value === '');
  toggleInput('ca-sdi-fields', fields.includeCaSdi, state === 'CA');

  const notes = {
    CA: '10.23% withholding, California income tax schedule and optional SDI.',
    NY: '11.70% withholding and an editable 6.85% state tax scenario.',
    MA: '5% base rates. Adjust for the surtax if it applies.',
    custom: 'Enter your rates under Medicare and state adjustments.'
  };
  text('state-note', notes[state] ?? '0% state wage income tax.');
}

function readInputs() {
  const inputs = {
    filing: fields.filing.value,
    state: fields.state.value,
    includeCaSdi: fields.includeCaSdi.checked,
    priorEligible: fields.priorEligible.checked
  };
  for (const input of numberFields) {
    if (input.disabled) continue;
    if (!input.validity.valid) {
      input.setAttribute('aria-invalid', 'true');
      throw new RangeError(`${input.labels[0].textContent}. ${input.validationMessage}`);
    }
    inputs[input.name] = input.value === '' ? undefined : input.valueAsNumber;
  }
  return inputs;
}

function renderGap(id, amount) {
  text(`${id}-label`, `${id === 'federal-gap' ? 'Federal income tax' : 'All-in vest tax'} ${amount < 0 ? 'withholding excess' : 'gap'}`);
  const value = document.getElementById(id);
  value.textContent = dollars(Math.abs(amount));
  value.classList.toggle('shortfall', amount > 0);
}

function renderTaxRows(result) {
  const tbody = document.getElementById('tax-rows');
  tbody.replaceChildren();
  const rows = Object.entries(taxLabels)
    .filter(([key]) => key !== 'statePayroll' || fields.includeCaSdi.checked && fields.state.value === 'CA')
    .map(([key, label]) => [label, result.withheld[key], result.actual[key]]);
  rows.push(['Total', result.totalWithheld, result.totalActual]);
  for (const [label, withheld, actual] of rows) {
    const row = tbody.insertRow();
    const header = document.createElement('th');
    header.scope = 'row';
    header.textContent = label;
    row.append(header);
    row.insertCell().textContent = dollars(withheld);
    row.insertCell().textContent = dollars(actual);
  }
}

function renderEstimate(estimate) {
  document.getElementById('estimate-results').hidden = !estimate;
  document.getElementById('estimate-missing').hidden = Boolean(estimate);
  if (!estimate) return;

  text('quarterly', dollars(estimate.quarterly));
  text('target', dollars(estimate.target));
  text('balance', dollars(estimate.balance));
  const prior = estimate.priorTarget === null
    ? '' : ` The eligible prior-year amount is ${dollars(estimate.priorTarget)} at ${estimate.priorRate}%.`;
  const exception = estimate.balance < 1000
    ? ' The projected balance after withholding is below $1,000.' : '';
  text('estimate-note', `90% of modeled 2026 federal tax is ${dollars(estimate.currentTarget)}.${prior} Projected federal withholding totals ${dollars(estimate.withholding)}.${exception}`);
}

function render() {
  for (const input of numberFields) input.removeAttribute('aria-invalid');
  try {
    const result = calculateVesting(readInputs());
    error.hidden = true;
    results.hidden = false;

    renderGap('federal-gap', result.federalGap);
    renderGap('total-gap', result.totalGap);
    text('vest-value', dollars(result.vestingValue));
    text('cover-shares', integers.format(result.coverShares));
    text('net-shares', integers.format(result.netShares));
    text('extra-shares', integers.format(result.extraShares));

    const shareNotes = [];
    if (result.coverCashNeeded > 0) {
      shareNotes.push(`Selling all ${integers.format(result.sharesSold)} vesting shares leaves ${dollars(result.coverCashNeeded)} of payroll withholding to fund in cash.`);
    }
    if (result.unfundedGap > 0) {
      shareNotes.push(`After selling the ${integers.format(result.extraSharesAvailable)} available net shares, the modeled tax gap still needs ${dollars(result.unfundedGap)}.`);
    }
    text('share-note', shareNotes.join(' '));
    document.getElementById('share-note').hidden = shareNotes.length === 0;
    renderTaxRows(result);
    renderEstimate(result.estimate);
    resultStatus.textContent = result.totalGap >= 0
      ? `Estimated shortfall on this vest is ${dollars(result.totalGap)}.`
      : `Estimated withholding exceeds modeled vest tax by ${dollars(-result.totalGap)}.`;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === fields.filing) syncFiling();
  if (event.target === fields.state || event.target === fields.stateTaxRate) {
    syncState(event.target === fields.state);
  }
  render();
});

syncFiling();
syncState();
render();

// Each manual slot needs an ad-unit ID issued for the configured publisher.
for (const unit of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (unit.dataset.adSlot) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
