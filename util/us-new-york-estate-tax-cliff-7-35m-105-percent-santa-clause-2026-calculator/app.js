import { calculateEstate, MAX_AMOUNT } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('estate-calculator');
const results = byId('estate-results');
const error = byId('input-error');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const zones = {
  EXEMPT: 'Covered by the exclusion',
  PHASE_OUT_CLIFF_TRAP: 'In the credit phase-out',
  CLIFF_LOST_ALL_CREDIT: 'Above the cliff · no credit',
};

function readMoney(id) {
  const field = byId(id);
  if (!field.validity.valid || field.valueAsNumber > MAX_AMOUNT) {
    throw new RangeError(`Enter ${field.dataset.amountName} in dollars and cents, from $0 to $2 billion.`);
  }
  return field.value === '' ? null : field.valueAsNumber;
}

function render() {
  let result;
  const year = Number(byId('estate-year').value);
  try {
    result = calculateEstate({
      year,
      taxableEstate: readMoney('estate-assets'),
      includibleGifts: readMoney('estate-gifts'),
    });
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    error.textContent = failure.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const federal = byId('federal-base');
  let federalPosition = 'Enter a federal filing base to compare.';
  if (!federal.validity.valid) {
    federalPosition = 'Enter a federal filing base from $0 to $2 billion, in dollars and cents.';
  } else if (federal.value !== '') {
    const difference = Math.round((federal.valueAsNumber - result.federalExclusion) * 100) / 100;
    federalPosition = difference === 0 ? `At the ${year} filing threshold.` :
      `${money.format(Math.abs(difference))} ${difference > 0 ? 'above' : 'below'} the ${year} filing threshold.`;
  }

  const values = {
    'tax-due': money.format(result.nyEstateTax),
    'tax-zone': result.nyTaxableEstate === result.cliff ? 'At the cliff · no credit' : zones[result.zone],
    'taxable-total': money.format(result.nyTaxableEstate),
    'due-before-credit': money.format(result.tentativeTax),
    'credit-remaining': money.format(result.applicableCredit),
    'credit-lost': money.format(result.creditLost),
    'gift-impact': money.format(result.giftTaxImpact),
    'excess-rate': result.excessTaxRate === null ? '—' : percent.format(result.excessTaxRate / 100),
    'marginal-rate': percent.format(result.marginalRate / 100),
    'santa-target': money.format(result.santaDonation),
    'heirs-without': money.format(result.heirsNetWithoutSanta),
    'heirs-with': result.santaFeasible ? money.format(result.heirsNetWithSanta) : 'Unavailable',
    'heirs-change': result.santaFeasible ? money.format(result.heirsNetGain) : 'Unavailable',
    'optimal-donation': result.santaFeasible ? money.format(result.optimalDonation) : 'Unavailable',
    'break-even': money.format(result.breakEven),
    'federal-exclusion': money.format(result.federalExclusion),
    'federal-position': federalPosition,
  };

  for (const [id, value] of Object.entries(values)) byId(id).textContent = value;
  byId('tax-zone').dataset.zone = result.zone;
  let santaNote = 'The modeled heirs’ amount is the same in both scenarios.';
  if (!result.santaFeasible) {
    santaNote = 'The amount needed to eliminate NY tax exceeds the estate assets available to give.';
  } else if (result.heirsNetGain > 0) {
    santaNote = 'At this taxable value, NY tax saved exceeds the bequest.';
  } else if (result.heirsNetGain < 0) {
    santaNote = 'At this taxable value, the bequest costs heirs more than the NY tax it saves.';
  } else if (result.santaDonation === 0) {
    santaNote = 'The exclusion already covers this estate.';
  }
  byId('santa-note').textContent = santaNote;
  byId('shortfall-note').hidden = result.heirsNetWithoutSanta >= 0;
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
