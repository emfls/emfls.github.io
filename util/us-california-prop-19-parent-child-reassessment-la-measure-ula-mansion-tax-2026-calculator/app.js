import { calculateProp19, calculateMeasureULA } from './model.mjs';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', signDisplay: 'exceptZero'
});
const byId = id => document.getElementById(id);
const usd = value => dollars.format(value);

function bindCalculator(id, calculate, render) {
  const form = byId(`${id}-form`);
  const result = byId(`${id}-result`);
  const error = byId(`${id}-error`);

  function update() {
    let values;
    try {
      values = calculate(form.elements);
    } catch (problem) {
      if (!(problem instanceof RangeError)) throw problem;
      error.textContent = problem.message;
      result.hidden = true;
      return;
    }
    for (const [field, value] of Object.entries(render(values))) {
      byId(`${id}-${field}`).textContent = value;
    }
    error.textContent = '';
    result.hidden = false;
  }

  form.addEventListener('input', update);
  form.addEventListener('submit', event => {
    event.preventDefault();
    update();
  });
  update();
}

bindCalculator('prop', fields => calculateProp19({
  priorAssessedValue: fields.prior.valueAsNumber,
  fairMarketValue: fields.market.valueAsNumber,
  taxRatePercent: fields.rate.valueAsNumber,
  exclusion: fields.exclusion.valueAsNumber,
  relationship: fields.relationship.value,
  familyHome: fields.home.value === 'yes',
  timelyOccupancy: fields.occupancy.value === 'yes'
}), values => ({
  status: values.eligible ? 'Qualifying family-home scenario.' : 'Full market-value reassessment at transfer.',
  assessed: usd(values.newAssessedValue),
  ceiling: usd(values.exclusionCeiling),
  tax: `${usd(values.priorAnnualTax)} → ${usd(values.newAnnualTax)}`,
  change: `${signedDollars.format(values.annualTaxChange)} per year`,
  ten: signedDollars.format(values.tenYearTaxChange),
  savings: values.annualMoveInSavings === null
    ? 'Unavailable for this transfer'
    : `${signedDollars.format(values.annualMoveInSavings)} per year · ${signedDollars.format(values.tenYearMoveInSavings)} over 10 years`
}));

bindCalculator('ula', fields => calculateMeasureULA({
  salePrice: fields.price.valueAsNumber,
  remainingLiens: fields.liens.valueAsNumber,
  period: fields.period.value
}), values => ({
  status: `${values.ulaRatePercent}% ULA on gross value · 4% above ${usd(values.lowerThreshold)} · 5.5% from ${usd(values.upperThreshold)}`,
  net: usd(values.sellerNetProceeds),
  tax: usd(values.ulaTax),
  base: `${usd(values.baseTransferTax)} (${usd(values.baseCityTax)} city · ${usd(values.baseCountyTax)} county)`,
  total: usd(values.totalTransferTax)
}));
