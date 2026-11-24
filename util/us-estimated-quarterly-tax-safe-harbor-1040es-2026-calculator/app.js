import { calculateSafeHarbor, DEADLINES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('tax-form');
const result = byId('results');
const status = byId('result-status');
const error = byId('error');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dates = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const money = value => currency.format(value);
const dateLabel = date => dates.format(new Date(date));
const write = (id, value) => { byId(id).textContent = value; };

const priorFields = [...form.querySelectorAll('[data-prior-field]')];
const quarterRates = [...form.querySelectorAll('[data-quarter-rate]')];
const paymentDates = [...form.querySelectorAll('[data-payment-date]')];
const paymentAmounts = [...form.querySelectorAll('[data-payment-amount]')];

function readInputs() {
  const priorRule = byId('prior-rule').value;
  const fullYear = priorRule === 'full-year';
  for (const field of priorFields) {
    field.hidden = !fullYear;
    field.querySelector('input').disabled = !fullYear;
  }

  const useQuarterlyRates = byId('rate-mode').value === 'quarterly';
  byId('flat-rate-field').hidden = useQuarterlyRates;
  byId('flat-rate').disabled = useQuarterlyRates;
  byId('quarter-rates').hidden = !useQuarterlyRates;
  for (const input of quarterRates) input.disabled = !useQuarterlyRates;

  for (const input of form.querySelectorAll('input:enabled')) {
    input.removeAttribute('aria-invalid');
  }
  const invalidInput = form.querySelector('input:invalid');
  if (invalidInput) {
    invalidInput.setAttribute('aria-invalid', 'true');
    throw new RangeError(`${invalidInput.labels[0].textContent}. ${invalidInput.validationMessage}`);
  }

  const payments = [];
  for (const [index, date] of paymentDates.entries()) {
    const amount = paymentAmounts[index];
    if (!date.value && !amount.value) continue;
    if (!date.value || !amount.value) {
      (date.value ? amount : date).setAttribute('aria-invalid', 'true');
      throw new RangeError(`Enter both a date and amount for payment ${index + 1}.`);
    }
    payments.push({ date: date.value, amount: amount.valueAsNumber });
  }

  return {
    currentTax: byId('current-tax').valueAsNumber,
    priorTax: fullYear ? byId('prior-tax').valueAsNumber : 0,
    priorAgi: fullYear ? byId('prior-agi').valueAsNumber : 0,
    filing: byId('filing').value,
    priorRule,
    withholding: byId('withholding').valueAsNumber,
    asOf: byId('as-of').value,
    extraWithholding: byId('extra-withholding').valueAsNumber,
    payments,
    rates: useQuarterlyRates
      ? quarterRates.map(input => input.valueAsNumber)
      : Array(quarterRates.length).fill(byId('flat-rate').valueAsNumber)
  };
}

function render() {
  let estimate;
  try {
    estimate = calculateSafeHarbor(readInputs());
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    result.hidden = true;
    status.textContent = 'Estimate unavailable until the highlighted input is corrected.';
    error.textContent = exception.message;
    return;
  }

  const {
    currentTarget, priorTarget, priorMultiplier, safeHarborTarget, remainingSafeHarborNeeded,
    paidAsOf, perQuarterPayment, nextDeadline, nextInstallmentNeeded, exception,
    baseline, voucherCatchUp, withholdingCatchUp
  } = estimate;

  write('target', money(safeHarborTarget));
  write('remaining', money(remainingSafeHarborNeeded));
  write('per-quarter', perQuarterPayment === null ? 'No dates left' : money(perQuarterPayment));
  write('next-needed', nextDeadline ? money(nextInstallmentNeeded) : 'No dates left');
  write('base-penalty', money(baseline.penalty));
  write('voucher-penalty', money(voucherCatchUp.penalty));
  write('w4-penalty', money(withholdingCatchUp.penalty));

  const priorDescription = priorTarget === null
    ? 'The prior-year comparison is unavailable.'
    : `The ${Math.round(priorMultiplier * 100)}% prior-year target is ${money(priorTarget)}.`;
  write('target-details', `The 90% current-year target is ${money(currentTarget)}. ${priorDescription} Estimated payments entered through the planning date total ${money(paidAsOf)}.`);

  const savings = Math.max(0, voucherCatchUp.penalty - withholdingCatchUp.penalty);
  write('comparison', savings > 0
    ? `In this scenario, payroll withholding reduces the estimated penalty by ${money(savings)} compared with the same January voucher.`
    : 'The two catch-up scenarios have the same estimated penalty at the selected rates.');

  const schedule = DEADLINES.map((deadline, index) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = dateLabel(deadline);
    row.append(heading);
    for (const scenario of [baseline, voucherCatchUp, withholdingCatchUp]) {
      row.insertCell().textContent = money(scenario.dueShortfalls[index]);
    }
    return row;
  });
  byId('schedule').replaceChildren(...schedule);

  const timing = nextDeadline
    ? `By ${dateLabel(nextDeadline)}, the cumulative payment needed is ${money(nextInstallmentNeeded)}.`
    : 'All four statutory payment dates have passed as of your planning date.';
  const exceptionMessage = {
    'under-1000': 'The under-$1,000 exception applies to the baseline.',
    'prior-no-liability': 'The qualifying zero-tax prior-year exception applies.'
  };
  error.textContent = '';
  status.textContent = exceptionMessage[exception] ?? timing;
  result.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();

// Queue manual display units only after a publisher-owned slot ID is configured.
for (const ad of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(ad.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
