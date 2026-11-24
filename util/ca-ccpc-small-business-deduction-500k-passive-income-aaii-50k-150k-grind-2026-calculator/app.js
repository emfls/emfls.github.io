import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('scenario');
const results = byId('results');
const error = byId('input-error');
const province = byId('province');
const includeCapital = byId('include-capital');
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2
});

function readNumber(id, label) {
  const field = byId(id);
  if (!field.validity.valid) {
    field.setAttribute('aria-invalid', 'true');
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return field.valueAsNumber;
}

function update() {
  const code = province.value;
  const useCapital = includeCapital.checked;
  byId('ontario-options').hidden = code !== 'ON';
  byId('quebec-options').hidden = code !== 'QC';
  byId('capital-options').hidden = !useCapital;
  for (const field of form.querySelectorAll('[aria-invalid]')) field.removeAttribute('aria-invalid');

  let estimate;
  try {
    estimate = calculate({
      province: code,
      aaii: readNumber('aaii', 'AAII amount'),
      activeIncome: readNumber('active-income', 'active business income amount'),
      includeCapital: useCapital,
      taxableCapital: useCapital ? readNumber('taxable-capital', 'taxable capital amount') : 0,
      ontarioDaysAfterJune: code === 'ON' ? readNumber('ontario-days', 'Ontario day count from 0 to 365') : undefined,
      quebecLaterYear: code === 'QC' && byId('quebec-year').value === 'late'
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.textContent = issue.message;
    return;
  }

  error.textContent = '';
  const values = {
    'extra-tax': cad.format(estimate.extraTax),
    'federal-limit': cad.format(estimate.federalLimit),
    'provincial-limit': cad.format(estimate.provincialLimit),
    'passive-reduction': cad.format(estimate.passiveReduction),
    'capital-reduction': useCapital ? cad.format(estimate.capitalReduction) : 'Excluded',
    'federal-shift': cad.format(estimate.federalShifted),
    'provincial-shift': cad.format(estimate.provincialShifted),
    'active-tax': cad.format(estimate.activeTax),
    'direct-passive': percent.format(estimate.directPassiveRate),
    'marginal-grind': cad.format(estimate.marginalGrind),
    'marginal-cash': percent.format(estimate.marginalCashRate),
    'marginal-after-refund': percent.format(estimate.marginalAfterRefundRate),
    'scenario-rates': `Combined active-business rates when both jurisdictions use the same band are ${percent.format(estimate.smallCombinedRate)} small business and ${percent.format(estimate.generalCombinedRate)} general.`
  };
  for (const [id, value] of Object.entries(values)) byId(id).textContent = value;
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
