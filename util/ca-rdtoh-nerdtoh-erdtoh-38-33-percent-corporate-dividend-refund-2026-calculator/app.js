import { calculate, MAX_AMOUNT } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const amountInputs = [...form.querySelectorAll('input[type="number"]')];
const mixedButton = byId('apply-mixed');
const nonEligibleButton = byId('apply-non-eligible');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const resultFields = [
  'total', 'aggregateInvestmentIncome', 'nerdtohAddition', 'erdtohAddition', 'availableNerdtoh',
  'availableErdtoh', 'eligibleFromErdtoh', 'nonEligibleFromNerdtoh', 'nonEligibleFromErdtoh',
  'remainingNerdtoh', 'remainingErdtoh', 'partITax', 'partIVEligible', 'partIVNonEligible',
  'corporateTax', 'netCorporateTax', 'personalTax', 'combinedTax', 'shareholderCash',
  'retainedCash', 'combinedCash', 'grossIncome', 'cashIfRetained'
];

let currentPayout;

function formatMoney(value) {
  return money.format(Math.abs(value) < 0.005 ? 0 : value);
}

function show(id, value) {
  byId(id).textContent = value;
}

function showMessage(id, message) {
  show(id, message);
  byId(id).hidden = !message;
}

function render() {
  const invalidInputs = amountInputs.filter((input) => !input.validity.valid);
  for (const input of amountInputs) input.setAttribute('aria-invalid', String(!input.validity.valid));
  const invalid = invalidInputs.length > 0;
  byId('refund-results').hidden = invalid;
  byId('cash-results').hidden = invalid;
  if (invalid) {
    currentPayout = undefined;
    const label = invalidInputs[0].labels[0].textContent;
    showMessage('input-error', `Enter a CAD amount from $0 to $1 billion, with up to two decimal places, for ${label}.`);
    showMessage('scenario-warning', '');
    return;
  }

  showMessage('input-error', '');
  const inputs = Object.fromEntries(amountInputs.map((input) => [input.name, input.valueAsNumber]));
  const result = calculate({ ...inputs, province: byId('province').value });
  currentPayout = result.payout;

  for (const key of resultFields) show(key, formatMoney(result[key]));
  show('noPayoutTax', formatMoney(result.corporateTax));
  const cashDifference = result.combinedCash - result.cashIfRetained;
  show('cashDifference', formatMoney(cashDifference));
  show('effectiveRate', result.effectiveRate === null ? 'Unavailable' : percent.format(result.effectiveRate));
  show('targetEligible', formatMoney(currentPayout.eligible));
  show('targetNonEligible', formatMoney(currentPayout.nonEligible));
  show('targetAllNonEligible', formatMoney(currentPayout.allNonEligible));
  mixedButton.disabled = Math.max(currentPayout.eligible, currentPayout.nonEligible) > MAX_AMOUNT;
  nonEligibleButton.disabled = currentPayout.allNonEligible > MAX_AMOUNT;
  byId('target-limit').hidden = !mixedButton.disabled && !nonEligibleButton.disabled;
  show('applied-rates', `Estimated rates on cash dividends: ${percent.format(result.eligibleRate)} eligible and ${percent.format(result.nonEligibleRate)} non-eligible. The passive Part I rate is ${percent.format(result.passiveCorporateRate)}.`);

  const warnings = [];
  if (result.preRefundShortfall >= 0.005) {
    warnings.push(`The planned payout exceeds modeled cash before the refund by ${formatMoney(result.preRefundShortfall)}.`);
  }
  if (result.eligibleRoomShortfall >= 0.005) {
    warnings.push(`The eligible payout exceeds the GRIP you entered by ${formatMoney(result.eligibleRoomShortfall)}.`);
  }
  if (cashDifference < -0.005) {
    warnings.push(`Paying these dividends leaves ${formatMoney(-cashDifference)} less combined cash today.`);
  }
  showMessage('scenario-warning', warnings.join(' '));
}

function applyPayout(eligible, nonEligible) {
  byId('eligiblePaid').value = eligible.toFixed(2);
  byId('nonEligiblePaid').value = nonEligible.toFixed(2);
  render();
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('change', render);
mixedButton.addEventListener('click', () => applyPayout(currentPayout.eligible, currentPayout.nonEligible));
nonEligibleButton.addEventListener('click', () => applyPayout(0, currentPayout.allNonEligible));
render();
