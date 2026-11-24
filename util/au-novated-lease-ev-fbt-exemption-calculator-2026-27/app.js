import { calculateComparison } from './model.mjs';

const form = document.getElementById('lease-form');
const results = document.getElementById('results');
const taperResults = document.getElementById('taper-results');
const error = document.getElementById('input-error');
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const percent = new Intl.NumberFormat('en-AU', { style: 'percent' });

const treatmentLabels = {
  exempt: 'Full FBT relief',
  discounted: 'Reduced 15% statutory fraction',
  standard: 'Standard 20% statutory fraction'
};

function money(value) {
  return currency.format(Math.abs(value) < 0.005 ? 0 : value);
}

function updateText(values) {
  for (const [id, value] of Object.entries(values)) {
    document.getElementById(id).textContent = value;
  }
}

function render() {
  const vehicle = form.elements.vehicle.value;
  form.elements.eligibilityConfirmed.disabled = vehicle !== 'bev';

  const invalid = [...form.elements].find(control => !control.validity.valid);
  if (invalid) {
    const label = invalid.labels[0].textContent.replace(/\s*\(.*\)$/, '');
    showError(`Check “${label}”. ${invalid.validationMessage}`);
    return;
  }

  const number = id => form.elements[id].valueAsNumber;
  const baseValue = form.elements.baseValue.value === '' ? null : number('baseValue');
  let comparison;
  try {
    comparison = calculateComparison({
      salary: number('salary'),
      price: number('price'),
      baseValue,
      onRoad: number('onRoad'),
      gstRunning: number('gstRunning'),
      otherRunning: number('otherRunning'),
      fees: number('fees'),
      leaseRate: number('leaseRate') / 100,
      loanRate: number('loanRate') / 100,
      offsetRate: number('offsetRate') / 100,
      years: Number(form.elements.years.value),
      vehicle,
      eligibilityConfirmed: form.elements.eligibilityConfirmed.checked,
      phase: form.elements.phase.value
    });
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause;
    showError(cause.message);
    return;
  }

  const { lease, cash, loan, savings, before, transition, phase, years } = comparison;
  const scenarioStatus = phase === 'current' ? 'Current rules' : 'Proposed rules';
  const cheapest = [
    ['Novated lease', lease.offsetAdjusted], ['Paying cash', cash.offsetAdjusted],
    ['Car loan', loan.offsetAdjusted]
  ].sort((a, b) => a[1] - b[1]);
  const lowest = Math.abs(cheapest[0][1] - cheapest[1][1]) < 0.005
    ? 'Two or more options tie for the lowest offset-adjusted cost.'
    : `${cheapest[0][0]} has the lowest offset-adjusted cost.`;

  updateText({
    term: `${years} years`,
    'comparison-status': `${scenarioStatus} · ${treatmentLabels[lease.kind]}. ${lowest}`,
    'lease-adjusted': money(lease.offsetAdjusted),
    'lease-nominal': money(lease.nominal),
    'lease-monthly': money(lease.net / 12),
    'lease-residual': money(lease.residual),
    'cash-adjusted': money(cash.offsetAdjusted),
    'cash-nominal': money(cash.nominal),
    'cash-opportunity': money(cash.purchaseOpportunity),
    'loan-adjusted': money(loan.offsetAdjusted),
    'loan-nominal': money(loan.nominal),
    'loan-monthly': money(loan.monthlyPayment),
    'loan-interest': money(loan.interest),
    'saving-cash': money(savings.cash),
    'saving-loan': money(savings.loan),
    'saving-cash-nominal': money(savings.cashNominal),
    'saving-loan-nominal': money(savings.loanNominal),
    'lease-base': money(comparison.baseValue),
    'gst-purchase': money(lease.gstPurchaseCredit),
    'gst-running': money(lease.gstRunningCredit),
    'lease-pre': money(lease.preTax),
    'lease-post': money(lease.postTax),
    'lease-fbt': money(lease.fbt),
    'tax-saving': money(lease.taxSaving),
    rfba: money(lease.rfba),
    'salary-plus-rfba': money(lease.salaryPlusRfba)
  });

  for (const [prefix, estimate] of [['before', before], ['after', transition]]) {
    updateText({
      [`${prefix}-rate`]: estimate ? percent.format(estimate.rate) : 'Unavailable',
      [`${prefix}-post`]: estimate ? money(estimate.postTax) : 'Unavailable',
      [`${prefix}-total`]: estimate ? money(estimate.nominal) : 'Unavailable'
    });
  }
  let taperMessage = 'One scenario exceeds the salary available for pre-tax packaging.';
  if (before && transition) {
    const difference = transition.nominal - before.nominal;
    taperMessage = 'Estimated out-of-pocket cost is unchanged for this car.';
    if (Math.abs(difference) >= 0.005) {
      taperMessage = `Under the proposal, the April start would cost ${money(Math.abs(difference))} ${difference > 0 ? 'more' : 'less'} out of pocket over ${years} years.`;
    }
  }
  document.getElementById('taper-delta').textContent = taperMessage;
  error.textContent = '';
  results.hidden = false;
  taperResults.hidden = false;
}

function showError(message) {
  error.textContent = message;
  results.hidden = true;
  taperResults.hidden = true;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();

// Initialise each placement only after a valid slot has been assigned to this publisher.
for (const ad of document.querySelectorAll('ins.adsbygoogle')) {
  if (/^\d{10}$/.test(ad.dataset.adSlot)) {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
}
