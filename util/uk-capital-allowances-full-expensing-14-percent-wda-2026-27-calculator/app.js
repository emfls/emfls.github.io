import { calculateAllowances, PERIODS, TAX_RATES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('allowances');
const business = byId('business');
const asset = byId('asset');
const date = byId('purchase-date');
const taxRate = byId('tax-rate');
const use = byId('use');
const results = byId('results');
const error = byId('error');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const format = value => money.format(value);

function updatePeriodAndRates() {
  const { start, end } = PERIODS[business.value];
  date.min = start;
  date.max = end;
  if (date.value && date.value < start) date.value = start;
  if (date.value > end) date.value = end;
  byId('period-note').textContent = business.value === 'company'
    ? 'Company period runs from 1 April 2026 to 31 March 2027.'
    : 'Income Tax period runs from 6 April 2026 to 5 April 2027.';
  taxRate.replaceChildren(...TAX_RATES[business.value].map(([rate, label]) => new Option(label, rate)));
}

function render() {
  const isCar = ['new-ev', 'low-co2', 'high-co2'].includes(asset.value);
  byId('asset-use').hidden = isCar;
  use.disabled = isCar;

  let estimate;
  try {
    estimate = calculateAllowances({
      business: business.value,
      asset: asset.value,
      cost: byId('cost').valueAsNumber,
      aiaUsed: byId('aia-used').valueAsNumber,
      taxRate: Number(taxRate.value),
      purchaseDate: date.value,
      use: isCar ? 'own' : use.value,
      includeProposals: byId('proposals').checked,
    });
  } catch (invalid) {
    results.hidden = true;
    error.textContent = invalid.message;
    error.hidden = false;
    return;
  }

  error.hidden = true;
  byId('path').textContent = estimate.path.join(' + ');
  byId('allowance').textContent = format(estimate.yearOneAllowance);
  byId('tax-saved').textContent = format(estimate.yearOneTaxSaved);
  byId('effective-cost').textContent = format(estimate.effectiveCost);
  byId('five-year').textContent = format(estimate.fiveYearTaxSaved);
  byId('aia-summary').textContent =
    `AIA used on this purchase ${format(estimate.aia)} · AIA remaining ${format(estimate.aiaRemaining)}`;

  byId('schedule').replaceChildren(...estimate.schedule.map((row, index) => {
    const tr = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = row.year;
    tr.append(year);
    for (const amount of [row.cumulativeTaxSaved, estimate.at14[index].cumulativeTaxSaved,
      estimate.at18[index].cumulativeTaxSaved]) {
      tr.insertCell().textContent = format(amount);
    }
    return tr;
  }));

  const delay = byId('delay');
  const note = byId('schedule-note');
  if (estimate.pool === 'special') {
    delay.textContent = 'The main-pool cut has no effect on assets in the 6% special pool.';
    note.textContent = 'All columns apply 6% to any eligible pooled balance.';
  } else {
    delay.textContent = estimate.fiveYearDelay14
      ? `The cut from 18% to 14% delays ${format(estimate.fiveYearDelay14)} of estimated tax savings beyond Year 5.`
      : 'The 14% and 18% rates give the same result because this purchase leaves no balance for WDA.';
    note.textContent = `The projection uses 14% in Year 1 and ${percent.format(estimate.schedule[1].wdaRate)} in Years 2–5 for any eligible main-pool balance.`;
  }
  if (estimate.fya > 0) {
    note.textContent += ' WDA on the balance after the partial first-year allowance starts in Year 2.';
  }

  const disposal = byId('disposal-result');
  disposal.hidden = estimate.disposalChargeShare === 0;
  if (!disposal.hidden) {
    disposal.textContent = `This claim can add ${percent.format(estimate.disposalChargeShare)} of the capital allowances disposal value to taxable profits as a balancing charge when you sell or dispose of the asset.`;
  }
  results.hidden = false;
}

form.addEventListener('input', event => {
  if (event.target === business) updatePeriodAndRates();
  render();
});
form.addEventListener('submit', event => event.preventDefault());
render();
