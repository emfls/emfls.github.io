import { calculateIht, PARAMETERS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('iht-form');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const giftNumbers = [1, 2, 3];
const moneyInputs = [...form.querySelectorAll('input[step="0.01"]')];
const numericInputs = [...form.querySelectorAll('input[type="number"]')];
const value = id => byId(id).valueAsNumber;
const moneyResults = {
  'total-tax': 'totalTax',
  'gross-result': 'grossEstate',
  'net-estate': 'netEstate',
  nrb: 'nrb',
  'available-nrb': 'availableNrb',
  'rnrb-taper': 'rnrbTaper',
  rnrb: 'rnrb',
  'gift-tax': 'giftTax',
  'gift-saved': 'giftTaperSaved',
  'estate-tax': 'estateTax',
  'net-inheritance': 'netInheritance',
};

for (const input of moneyInputs) input.max = PARAMETERS.maxMoney;

function renderCharity(result) {
  if (result.charityBaseline === 0) {
    return 'The charity baseline is zero. There is no 36% threshold to meet.';
  }

  const target = `The 10% threshold is ${gbp.format(result.charityTarget)}.`;
  if (result.charityExtra === 0) {
    return `${target} Your legacy qualifies for 36% on any taxable death estate.`;
  }

  const extra = `${target} Reaching it takes ${gbp.format(result.charityExtra)} more.`;
  if (!result.charityTargetFeasible) {
    return `${extra} There are too few other assets to fund the increase while keeping the spouse legacy and qualifying home share intact.`;
  }

  const delta = result.heirsDeltaAtThreshold;
  if (delta === 0) return `${extra} The other heirs would receive the same amount.`;
  return `${extra} The other heirs would receive ${gbp.format(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} after tax.`;
}

function renderGifts(gifts) {
  byId('gift-details').hidden = gifts.length === 0;
  const items = gifts.map(gift => {
    const item = document.createElement('li');
    const label = `Gift ${gift.number} · ${gbp.format(gift.amount)}`;
    item.textContent = gift.exempt
      ? `${label} · Exempt after seven years`
      : `${label} · ${gbp.format(gift.nrbUsed)} of NRB used · ${gbp.format(gift.taxable)} above NRB at ${percent.format(gift.rate)} · ${gbp.format(gift.tax)} tax`;
    return item;
  });
  byId('gift-results').replaceChildren(...items);
}

function render() {
  const qualifyingResidence = byId('qualifying-residence').checked;
  byId('home-field').hidden = !qualifyingResidence;
  byId('home-net-value').disabled = !qualifyingResidence;

  const result = calculateIht({
    grossEstate: value('gross-estate'),
    debts: value('debts'),
    spouseGift: value('spouse-gift'),
    charityGift: value('charity-gift'),
    homeNetValue: value('home-net-value'),
    qualifyingResidence,
    transferNrbPercent: value('transfer-nrb'),
    transferRnrbPercent: value('transfer-rnrb'),
    gifts: giftNumbers.map(number => ({
      amount: value(`gift-amount-${number}`),
      years: value(`gift-years-${number}`),
    })),
  });

  for (const [id, key] of Object.entries(moneyResults)) byId(id).textContent = gbp.format(result[key]);
  byId('effective-rate').textContent = percent.format(result.effectiveRate);
  byId('estate-tax-label').textContent = `Death estate IHT at ${percent.format(result.estateRate)}`;
  byId('charity-result').textContent = renderCharity(result);
  renderGifts(result.giftBreakdown);

  const messages = [];
  if (numericInputs.some(input => !input.disabled && !input.validity.valid)) {
    messages.push('Use non-negative values within the field limits. Estimates clamp out-of-range entries and round money to pennies.');
  }
  if (result.debts > result.grossEstate) messages.push('Debts exceed gross assets. The net estate is £0.');
  if ((value('spouse-gift') || 0) + (value('charity-gift') || 0) > result.netEstate) {
    messages.push('Legacies exceed the net estate. The estimate caps the spouse legacy first, then the charity legacy.');
  }
  if (qualifyingResidence && value('home-net-value') > result.qualifyingHome
      && value('home-net-value') > result.netEstate - result.spouseGift - result.charityGift + .005) {
    messages.push('The qualifying home share is capped at the estate left after the spouse and charity legacies.');
  }
  const notice = byId('input-notice');
  notice.textContent = messages.join(' ');
  notice.hidden = messages.length === 0;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', event => event.preventDefault());
render();

// Reserve both placements until each has a publisher-issued slot ID.
for (const ad of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(ad.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
