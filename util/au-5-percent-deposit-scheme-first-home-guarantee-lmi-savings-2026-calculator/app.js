import { comparePaths, WAIT_LIMIT_MONTHS } from './model.mjs';

const form = document.querySelector('#scenario-inputs');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const capStatus = document.querySelector('#cap-status');
const fields = [...form.elements].filter(field => field.type === 'number');
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code',
  minimumFractionDigits: 0, maximumFractionDigits: 2
});
const percent = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const formatMoney = value => value === null ? '—' : money.format(value).replace('AUD', 'A$');

function output(id, value) {
  const element = document.getElementById(id);
  if (element.textContent !== value) element.textContent = value;
}

function warningFor(wait) {
  if (wait.months === null) {
    return `Your savings do not reach 20% within ${WAIT_LIMIT_MONTHS / 12} years under these assumptions. Rent continues while you save.`;
  }
  if (wait.months === 0) return 'You already have enough saved for a 20% deposit at the entered price.';
  let warning = `The wait would cost about ${formatMoney(wait.rentPaid)} in rent at the current rate.`;
  if (wait.priceChange > 0) warning += ` The property would cost ${formatMoney(wait.priceChange)} more under your growth assumption.`;
  if (wait.priceChange < 0) warning += ` The property would cost ${formatMoney(-wait.priceChange)} less under your growth assumption.`;
  return warning;
}

function render({ scheme, standard, wait, principal, deposit, depositShortfall, lvr }, years) {
  const withinCap = scheme.status === 'PASS';
  capStatus.dataset.state = scheme.status;
  output('cap-status', withinCap
    ? `PASS · Purchase price meets the ${formatMoney(scheme.cap)} cap.`
    : `OVER_CAP · Purchase price is ${formatMoney(scheme.excess)} above the ${formatMoney(scheme.cap)} cap.`);
  const depositCheck = depositShortfall
    ? `You are ${formatMoney(depositShortfall)} short of this buy-now deposit, before buying costs.`
    : 'Your current savings cover this deposit, before buying costs.';
  output('deposit-status', `Buy-now deposit ${formatMoney(deposit)} · ${percent.format(lvr)}% base LVR. ${depositCheck}`);

  const assumedDuty = standard.duty === null ? 'Confirm local duty' : formatMoney(standard.duty);
  const waitTime = wait.months === null
    ? `No target reached within ${WAIT_LIMIT_MONTHS / 12} years`
    : wait.months === 0 ? 'Already saved' : `${wait.months} ${wait.months === 1 ? 'month' : 'months'}`;
  const values = {
    'scheme-lmi': scheme.lmi,
    'lmi-avoided': withinCap ? standard.upfront : null,
    'scheme-loan': withinCap ? principal : null,
    'scheme-payment': scheme.monthlyPayment,
    'standard-loan': principal,
    'standard-premium': standard.premium,
    'standard-lmi': standard.upfront,
    'standard-payment': standard.monthlyUpfront,
    'capitalised-loan': standard.capitalisedPrincipal,
    'capitalised-payment': standard.monthlyCapitalised,
    'capitalised-interest': standard.extraInterest,
    'wait-gap': wait.gapToday,
    'wait-price': wait.futurePrice ?? null,
    'wait-deposit': wait.requiredDeposit ?? null,
    'wait-rent': wait.rentPaid ?? null,
    'wait-loan': wait.futureLoan ?? null,
    'wait-payment': wait.monthlyPayment
  };
  for (const [id, value] of Object.entries(values)) output(id, formatMoney(value));

  output('standard-duty', assumedDuty);
  output('interest-label', `Extra interest over ${years} ${years === 1 ? 'year' : 'years'} if LMI is added`);
  output('wait-months', waitTime);
  output('waiting-warning', warningFor(wait));
}

function calculate() {
  const invalidFields = fields.filter(field => !field.validity.valid);
  for (const field of fields) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }

  let message = '';
  if (invalidFields.length) {
    const first = invalidFields[0];
    message = `${first.labels[0].textContent}: ${first.validationMessage}`;
  } else {
    const numericInputs = Object.fromEntries(fields.map(field => [field.name, field.valueAsNumber]));
    try {
      render(comparePaths({ ...numericInputs, region: form.elements.region.value }), numericInputs.years);
    } catch (issue) {
      if (!(issue instanceof RangeError)) throw issue;
      message = issue.message;
    }
  }

  if (message) {
    output('waiting-warning', 'Rent continues while you save and any rise in prices increases the deposit you need.');
  }
  error.hidden = !message;
  results.hidden = Boolean(message);
  output('input-error', message);
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => event.preventDefault());
calculate();
