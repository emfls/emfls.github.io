import { calculateQsbs, STATE_PRESETS } from './model.mjs';

const get = (id) => document.getElementById(id);
const number = (id) => get(id).valueAsNumber;
const value = (id) => get(id).value;
const checked = (id) => get(id).checked;
const money = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent', maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long', timeZone: 'UTC',
});
const moneyFields = [
  'excludedGain', 'totalTax', 'gain', 'cap', 'partialTaxableGain',
  'regularTaxableGain', 'federalTax', 'stateTax',
];

function update() {
  const statePreset = value('statePreset');
  const predefinedState = STATE_PRESETS[statePreset];
  get('custom-state').hidden = Boolean(predefinedState);
  const state = predefinedState ?? { mode: statePreset, rate: number('stateRate') / 100 };
  const input = {
    acquired: value('acquired'),
    issued: value('issued') || value('acquired'),
    sold: value('sold'),
    proceeds: number('proceeds'),
    basis: number('basis'),
    grossAssets: number('grossAssets'),
    limitBasis: value('limitBasis') === '' && !get('limitBasis').validity.badInput
      ? undefined : number('limitBasis'),
    numberOfTaxpayers: number('numberOfTaxpayers'),
    priorEligibleGain: number('priorEligibleGain'),
    otherwiseQualifies: checked('otherwiseQualifies'),
    marriedSeparate: checked('marriedSeparate'),
    ltcgRate: number('ltcgRate') / 100,
    ordinaryRate: number('ordinaryRate') / 100,
    partialRate: number('partialRate') / 100,
    niit: checked('niit'),
    stateMode: state.mode,
    stateRate: state.rate,
  };

  let result;
  try {
    result = calculateQsbs(input);
  } catch (error) {
    get('result').hidden = true;
    get('error').textContent = error.message;
    get('error').hidden = false;
    return;
  }

  get('error').hidden = true;
  get('error').textContent = '';
  for (const field of moneyFields) get(field).textContent = money.format(result[field]);
  get('effectiveFederalRate').textContent = result.gain > 0
    ? percent.format(result.effectiveFederalRate) : '—';
  get('savings-label').textContent = result.savings < 0
    ? 'Additional tax vs. no exclusion' : 'Tax savings vs. no exclusion';
  get('savings').textContent = money.format(Math.abs(result.savings));

  const regime = result.regime === 'expanded' ? 'OBBBA expanded' : 'Legacy';
  get('scenario').textContent = regime + ' · ' + percent.format(result.exclusionRate)
    + ' exclusion tier · ' + (result.longTerm ? 'Long-term' : 'Short-term');
  const notes = [];
  if (!result.passesAssetTest) {
    notes.push('Issuer gross assets exceed the ' + money.format(result.assetCeiling) + ' ceiling.');
  }
  if (!input.otherwiseQualifies) notes.push('Other federal eligibility requirements are marked unmet.');
  if (result.gain <= 0) notes.push('There is no positive gain. The estimate excludes any tax benefit from losses.');
  if (input.sold > '2026-12-31' || input.issued > '2026-12-31') {
    notes.push('Projection using 2026 caps before later inflation adjustments.');
  }
  get('result-note').textContent = notes.join(' ');

  let comparison = '';
  if (result.nextTierDate && result.gain > 0) {
    const later = calculateQsbs({ ...input, sold: result.nextTierDate });
    const date = dateFormat.format(new Date(result.nextTierDate + 'T00:00:00Z'));
    comparison = 'At the same price, the next tier starts ' + date + '. Estimated tax at that tier is '
      + money.format(later.totalTax) + ' (' + percent.format(later.exclusionRate) + ' exclusion).';
  }
  get('comparison').textContent = comparison;
  get('result').hidden = false;
}

get('qsbs').addEventListener('input', update);
get('qsbs').addEventListener('submit', (event) => event.preventDefault());
update();
