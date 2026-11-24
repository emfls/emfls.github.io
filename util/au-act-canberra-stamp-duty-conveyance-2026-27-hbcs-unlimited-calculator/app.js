import { calculateDuty, CLIFF_VALUE } from './model.mjs';

const form = document.getElementById('duty-form');
const valueInput = document.getElementById('dutiable-value');
const scenario = document.getElementById('scenario');
const hbcsChecks = document.getElementById('hbcs-checks');
const adults = document.getElementById('hbcs-adults');
const ownership = document.getElementById('hbcs-ownership');
const results = document.getElementById('duty-results');
const error = document.getElementById('duty-error');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'code' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function show(id, text) {
  document.getElementById(id).textContent = text;
}

function update() {
  const claimHbcs = scenario.value === 'hbcs';
  hbcsChecks.hidden = !claimHbcs;
  hbcsChecks.disabled = !claimHbcs;

  let duty;
  try {
    duty = calculateDuty(valueInput.valueAsNumber, {
      use: scenario.value === 'investor' ? 'investor' : 'owner',
      claimHbcs,
      adultsBuyingPersonally: adults.checked,
      meetsOwnershipTest: ownership.checked
    });
  } catch (invalid) {
    valueInput.setAttribute('aria-invalid', 'true');
    error.textContent = invalid.message;
    results.hidden = true;
    show('cliff-status', '');
    return;
  }

  valueInput.removeAttribute('aria-invalid');
  error.textContent = '';
  results.hidden = false;
  show('act-payable', money.format(duty.payable));
  show('effective-rate', percent.format(duty.effectiveRate / 100));
  show('hbcs-savings', money.format(duty.hbcsSavings));
  show('duty-gap', money.format(duty.ownerInvestorGap));
  show('act-owner', money.format(duty.ownerDuty));
  show('act-investor', money.format(duty.investorDuty));
  show('nsw-duty', money.format(duty.nsw));
  show('vic-duty', money.format(duty.vic));
  show('hbcs-status', claimHbcs && !duty.hbcsApplied
    ? 'Owner-occupier duty applies to this estimate. Confirm both HBCS requirements to see the concession scenario.'
    : duty.hbcsApplied
      ? 'HBCS applied in this estimate. Savings are measured against standard ACT owner-occupier duty.'
      : 'Savings shown are for the selected scenario. Choose HBCS to check the concession.');
  const threshold = money.format(CLIFF_VALUE);
  show('cliff-status', duty.aboveCliff
    ? `Above ${threshold}, both standard ACT schedules charge 4.54% of the entire value.`
    : `At or below ${threshold}, the standard ACT schedules use marginal brackets.`);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
