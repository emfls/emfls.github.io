import { compareExit, MAX_AMOUNT } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const error = byId('error');
const asset = byId('asset');
const split = byId('split');
const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});
const personFields = ['taxableIncome', 'otherGains', 'giftAid', 'pension', 'currentLosses', 'carriedLosses'];
const breakdownRows = [
  ['Annual exemption used', 'exemptionUsed'],
  ['Current-year losses used', 'currentLossesUsed'],
  ['Brought-forward losses used', 'carriedLossesUsed'],
  ['Unused losses to carry forward', 'lossesToCarry'],
  ['Basic-rate band before gains', 'basicBandRemaining'],
  ['BADR limit available before sale', 'badrAvailable'],
  ['Taxable BADR gain at 18%', 'badrTaxable'],
  ['Standard gain at 18%', 'standardAt18'],
  ['Standard gain at 24%', 'standardAt24'],
  ['Estimated CGT', 'tax'],
];

for (const input of form.querySelectorAll('input[type=number]')) input.max = MAX_AMOUNT;

function readAmount(id) {
  const input = byId(id);
  if (!input.validity.valid) {
    const label = input.labels[0].textContent.replace(' (£)', '');
    const owner = id.startsWith('partner-') ? 'Spouse or civil partner — ' : '';
    throw new RangeError(`${owner}${label}: enter a non-negative pound amount to the nearest penny.`);
  }
  return input.valueAsNumber;
}

function readPerson(prefix) {
  const qualifies = asset.value === 'business' && byId(`${prefix}-qualifies`).checked;
  return {
    ...Object.fromEntries(personFields.map((key) => [key, readAmount(`${prefix}-${key}`)])),
    qualifies,
    priorBadrGains: qualifies ? readAmount(`${prefix}-priorBadrGains`) : 0,
  };
}

function syncFields() {
  const property = asset.value === 'property';
  byId('property-relief').hidden = !property;
  byId('property-warning').hidden = !property;
  byId('disposalRelief').disabled = !property;
  byId('partner-details').hidden = !split.checked;
  byId('partner-details').disabled = !split.checked;

  for (const prefix of ['owner', 'partner']) {
    const business = asset.value === 'business';
    const qualifies = business && byId(`${prefix}-qualifies`).checked;
    byId(`${prefix}-badr`).hidden = !business;
    byId(`${prefix}-qualifies`).disabled = !business;
    byId(`${prefix}-prior`).hidden = !qualifies;
    byId(`${prefix}-priorBadrGains`).disabled = !qualifies;
  }
}

function element(tag, value) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  return node;
}

function addRow(list, label, amount) {
  const row = element('div');
  row.append(element('dt', label), element('dd', money.format(amount)));
  list.append(row);
}

function createEstimateView(prefix) {
  const tax = byId(`${prefix}-tax`);
  const container = byId(`${prefix}-breakdown`);
  const summary = element('dl');
  const details = element('details');
  const breakdown = element('div');
  details.append(element('summary', 'View tax breakdown'), breakdown);
  container.append(summary, details);

  return (estimate) => {
    tax.textContent = money.format(estimate.tax);
    summary.replaceChildren();
    breakdown.replaceChildren();
    if (estimate.people.length === 2) {
      addRow(summary, 'Combined tax without transfer', estimate.withoutTransferTax);
      const savingsLabel = estimate.savings < 0 ? 'Extra tax with split' : 'Tax saved with split';
      addRow(summary, savingsLabel, Math.abs(estimate.savings));
    }

    estimate.people.forEach((person, index) => {
      const list = element('dl');
      if (estimate.people.length === 2) {
        breakdown.append(element('h4', index === 0 ? 'You' : 'Spouse or civil partner'));
        addRow(list, 'Share of disposal gain or loss', person.disposalGain);
      }
      breakdownRows.forEach(([label, key]) => addRow(list, label, person[key]));
      breakdown.append(list);
    });
  };
}

const renderBefore = createEstimateView('before');
const renderAfter = createEstimateView('after');

function update() {
  syncFields();
  try {
    const comparison = compareExit({
      proceeds: readAmount('proceeds'),
      costBasis: readAmount('costBasis'),
      fees: readAmount('fees'),
      disposalRelief: asset.value === 'property' ? readAmount('disposalRelief') : 0,
      owner: readPerson('owner'),
      partner: split.checked ? readPerson('partner') : null,
    });

    renderBefore(comparison.before);
    renderAfter(comparison.after);
    byId('extra-tax').textContent = money.format(comparison.extraTax);
    const gainLabel = comparison.disposalGain < 0 ? 'Disposal loss' : 'Disposal gain';
    const scope = split.checked ? 'Combined tax with a 50/50 split.' : 'Tax for one owner.';
    byId('result-summary').textContent =
      `${gainLabel} ${money.format(Math.abs(comparison.disposalGain))}. ${scope} ` +
      `Estimated tax ${money.format(comparison.before.tax)} in 2026/27 and ${money.format(comparison.after.tax)} under the proposal.`;
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
