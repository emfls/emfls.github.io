import { compareMethods } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const assetList = byId('assets');
const addAssetButton = byId('add-asset');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol' });
const hoursFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
let assetId = 0;

function setText(id, value) {
  byId(id).textContent = value;
}

function number(id) {
  return byId(id).valueAsNumber;
}

function maybeNumber(input) {
  return input.value === '' ? undefined : input.valueAsNumber;
}

function addAsset(defaults = {}, focus = false) {
  const asset = byId('asset-template').content.firstElementChild.cloneNode(true);
  assetId += 1;
  asset.querySelector('legend').textContent = `Equipment ${assetId}`;
  for (const input of asset.querySelectorAll('input[type="number"]')) {
    input.id = `asset-${assetId}-${input.dataset.field}`;
    input.previousElementSibling.htmlFor = input.id;
    const initialValue = defaults[input.dataset.field];
    if (initialValue != null) input.value = initialValue;
  }
  asset.querySelector('[data-remove]').addEventListener('click', () => {
    asset.remove();
    addAssetButton.focus();
    render();
  });
  assetList.append(asset);
  if (focus) asset.querySelector('input').focus();
}

function readAssets() {
  return Array.from(assetList.children, asset => {
    const get = field => asset.querySelector(`[data-field="${field}"]`);
    return {
      cost: get('cost').valueAsNumber,
      workPercent: get('workPercent').valueAsNumber,
      life: get('life').valueAsNumber,
      days: get('days').valueAsNumber,
      openingValue: maybeNumber(get('openingValue')),
      immediate: get('immediate').checked,
    };
  });
}

function syncFields() {
  const mode = byId('energy').value;
  for (const option of ['usage', 'share']) {
    const fields = byId(`${option}-fields`);
    fields.hidden = option !== mode;
    for (const input of fields.querySelectorAll('input')) input.disabled = fields.hidden;
  }
  byId('cleaning').disabled = !byId('dedicated').checked;
  const hasLoggedHours = byId('logged').value !== '';
  for (const id of ['days', 'hours', 'weeks']) byId(id).disabled = hasLoggedHours;
  for (const asset of assetList.children) {
    const immediate = asset.querySelector('[data-field="immediate"]').checked;
    asset.querySelector('[data-field="life"]').disabled = immediate;
  }
}

function readComparison() {
  const method = byId('energy').value;
  return compareMethods({
    income: number('income'),
    levyRate: Number(byId('levy').value),
    daysPerWeek: number('days'),
    hoursPerDay: number('hours'),
    weeks: number('weeks'),
    loggedHours: maybeNumber(byId('logged')),
    energy: method === 'usage'
      ? { method, unitsPerHour: number('units'), rate: number('rate'), gas: number('gas') }
      : { method, annual: number('energyBill'), percent: number('energyPercent') },
    internet: number('internet'),
    internetPercent: number('internetPercent'),
    phone: number('phone'),
    phonePercent: number('phonePercent'),
    supplies: number('supplies'),
    dedicatedOffice: byId('dedicated').checked,
    cleaning: number('cleaning'),
    repairs: number('repairs'),
    assets: readAssets(),
  });
}

function render() {
  syncFields();
  const error = byId('error');
  const values = byId('result-values');
  try {
    const invalid = form.querySelector('input:invalid');
    if (invalid) {
      const label = invalid.labels[0].textContent.trim();
      throw new RangeError(`${label} — ${invalid.validationMessage}`);
    }
    const result = readComparison();
    const names = { fixed: 'Fixed rate scenario', actual: 'Actual cost', tie: 'Same deduction' };
    const aud = value => money.format(value);
    const hourSource = byId('logged').value === '' ? 'from weekly schedule' : 'from annual log';
    setText('hours-result', `${hoursFormat.format(result.hours)} WFH hours (${hourSource})`);
    setText('fixed-total', aud(result.fixedTotal));
    setText('actual-total', aud(result.actualTotal));
    setText('winner', names[result.winner]);
    setText('extra-deduction', aud(result.extraDeduction));
    setText('winning-saving', aud(result.winningSaving));
    setText('extra-saving', aud(result.extraTaxSaving));
    setText('tax-detail', `Estimated saving by method — fixed ${aud(result.fixedSaving)}, actual ${aud(result.actualSaving)}. Amounts in AUD.`);
    setText('levy-note', byId('levy').value === '0.02'
      ? 'Includes the standard 2% levy over the full taxable income range. Check whether a lower levy or exemption applies to you before relying on the estimate.'
      : 'Income tax only. The estimate excludes the Medicare levy.');
    setText('fixed-detail', `Fixed hourly amount: ${aud(result.fixedBase)}.`);
    setText('actual-detail', `Actual running costs: ${aud(result.actualBase)} (energy ${aud(result.energy)}, internet ${aud(result.internet)}, phone ${aud(result.phone)}, work supplies ${aud(number('supplies'))}).`);
    setText('shared-detail', `Added to either method: ${aud(result.shared)} (equipment ${aud(result.assets)}, office cleaning ${aud(result.cleaning)}, repairs ${aud(result.repairs)}).`);
    error.hidden = true;
    values.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    values.hidden = true;
  }
}

addAsset({ cost: 1600, workPercent: 75 });
addAssetButton.addEventListener('click', () => {
  addAsset({}, true);
  render();
});
form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
