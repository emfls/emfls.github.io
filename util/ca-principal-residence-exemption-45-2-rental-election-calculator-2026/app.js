import { compareStrategies, marginalRate, TOP_MARGINAL_RATES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('pre-form');
const fields = [
  'adjustedCostBase', 'fmvAtConversion', 'salePrice', 'sellingCosts',
  'totalTaxYearsOwned', 'occupiedDesignations', 'eligibleRentalYears',
];
const formatMoney = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format;
const formatPercent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 }).format;

for (const [province, rate] of Object.entries(TOP_MARGINAL_RATES)) {
  const option = byId('ratePreset').querySelector(`option[value="${province}"]`);
  option.textContent += ` (${formatPercent(rate / 100)})`;
}

function showEstimate(prefix, estimate) {
  byId(`${prefix}-tax`).textContent = formatMoney(estimate.tax);
  byId(`${prefix}-gain`).textContent = formatMoney(estimate.grossCapitalGain);
  byId(`${prefix}-exempt`).textContent = formatMoney(estimate.exemptGain);
  byId(`${prefix}-remaining`).textContent = formatMoney(estimate.remainingCapitalGain);
  byId(`${prefix}-taxable`).textContent = formatMoney(estimate.taxableCapitalGain);
}

function calculate() {
  const preset = byId('ratePreset').value;
  const customRate = byId('customRate');
  customRate.disabled = preset !== 'custom';
  byId('custom-field').hidden = customRate.disabled;

  const inputs = Object.fromEntries(fields.map(id => [id, byId(id).valueAsNumber]));
  inputs.residentAtAcquisition = byId('residentAtAcquisition').checked;
  inputs.claimedCCA = byId('claimedCCA').checked;
  let comparison;
  try {
    inputs.marginalTaxRate = marginalRate(preset, customRate.valueAsNumber);
    comparison = compareStrategies(inputs);
  } catch (error) {
    byId('results').hidden = true;
    byId('input-error').textContent = error.message;
    byId('input-error').hidden = false;
    return;
  }

  const { election, noElection, preferred, savings } = comparison;
  const summary = {
    election: `The 45(2) election has the lower estimate by ${formatMoney(savings)}.`,
    noElection: `The FMV reset has the lower estimate by ${formatMoney(savings)}.`,
    tie: 'Both strategies produce the same estimated capital gains tax.',
    unavailable: 'No recommendation after a CCA claim. Strategy B shows the estimate if no election was in force at conversion.',
  };
  byId('input-error').hidden = true;
  byId('results').hidden = false;
  byId('comparison').textContent = summary[preferred];
  byId('applied-rate').textContent = `Applied combined marginal rate ${formatPercent(inputs.marginalTaxRate / 100)}. Amounts in CAD.`;
  byId('election-card').dataset.preferred = String(preferred === 'election');
  byId('reset-card').dataset.preferred = String(preferred === 'noElection');
  byId('election-details').hidden = !election;
  byId('election-unavailable').hidden = Boolean(election);
  byId('election-tax').hidden = !election;

  showEstimate('reset', noElection);
  if (election) {
    showEstimate('election', election);
    byId('election-years').textContent = `${election.yearsDesignatedAsPR} + ${election.plusOne} of ${inputs.totalTaxYearsOwned}`;
    byId('election-rental').textContent = String(election.rentalDesignations);
    byId('election-share').textContent = formatPercent(election.exemptFraction);
  }
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});
calculate();
