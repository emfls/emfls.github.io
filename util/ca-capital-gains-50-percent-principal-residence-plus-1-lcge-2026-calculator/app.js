import { calculateCapitalGains, TOP_RATES } from './model.mjs';

const form = document.getElementById('gains-form');
const result = document.getElementById('results');
const error = document.getElementById('error');
const comparison = document.getElementById('proposal');
const fields = form.elements;
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const money = (value) => currency.format(Math.abs(value) < 0.005 ? 0 : value);
const rate = (value) => percent.format(value / 100);

for (const option of fields.province.options) {
  if (option.value === 'custom') continue;
  const topRate = rate(TOP_RATES[option.value]);
  option.textContent += ` (${topRate})`;
}

function update() {
  const asset = fields.asset.value;
  const province = fields.province.value;

  for (const [group, active] of [
    ['residence-fields', asset === 'residence'],
    ['lcge-fields', asset === 'qualified'],
    ['custom-fields', province === 'custom'],
  ]) {
    const fieldset = document.getElementById(group);
    fieldset.hidden = !active;
    fieldset.disabled = !active;
  }

  try {
    const invalid = [...fields].find((field) => field.willValidate && !field.validity.valid);
    if (invalid) {
      throw new Error(`${invalid.labels[0].textContent} — ${invalid.validationMessage}`);
    }

    const estimate = calculateCapitalGains({
      proceeds: fields.proceeds.valueAsNumber,
      adjustedCostBase: fields.adjustedCostBase.valueAsNumber,
      sellingExpenses: fields.sellingExpenses.valueAsNumber,
      capitalLosses: fields.capitalLosses.valueAsNumber,
      asset,
      ownershipYears: fields.ownershipYears.valueAsNumber,
      designatedYears: fields.designatedYears.valueAsNumber,
      residentAtAcquisition: fields.residentAtAcquisition.value === 'yes',
      priorLcgeUsed: fields.priorLcgeUsed.valueAsNumber,
      province,
      customRate: fields.customRate.valueAsNumber,
    });

    for (const [id, value] of Object.entries({
      'gross-gain': money(estimate.grossGain),
      'net-gain': money(estimate.netCapitalGain),
      'pre-exempt': `${money(estimate.preExempt)} (${percent.format(estimate.exemptFraction)})`,
      'lcge-applied': money(estimate.lcgeApplied),
      'lcge-remaining': money(estimate.remainingLcge - estimate.lcgeApplied),
      'taxable-gain': money(estimate.taxableCapitalGain),
      'net-taxable-gain': money(estimate.netTaxableCapitalGain),
      'estimated-tax': money(estimate.estimatedTax),
      'effective-rate': rate(estimate.effectiveRate),
      'applied-rate': rate(estimate.marginalRate),
      'current-tax': money(estimate.estimatedTax),
      'proposal-tax': money(estimate.proposalTax),
      'tax-saved': money(estimate.taxSaved),
    })) {
      document.getElementById(id).textContent = value;
    }
    document.getElementById('lcge-balance').hidden = asset !== 'qualified';
    document.getElementById('amt-note').hidden = !estimate.amtReview;
    document.getElementById('residence-loss').hidden = !estimate.residenceLossDisallowed;
    comparison.hidden = !estimate.showComparison;
    result.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (issue) {
    result.hidden = true;
    error.hidden = false;
    error.textContent = issue.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
