import { calculatePension, PRIOR_YEARS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('pension-form');
const result = byId('pension-results');
const errorOutput = byId('form-error');
const mpaa = byId('mpaa');
const years = PRIOR_YEARS.map((_, index) => ({
  unused: byId(`unused-${index}`),
  member: byId(`member-${index}`),
  used: byId(`used-${index}`),
  left: byId(`left-${index}`),
}));
const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2,
});

function setAmount(id, amount) {
  byId(id).textContent = amount === null ? 'None' : gbp.format(amount);
}

function render() {
  const mpaaTriggered = mpaa.checked;
  byId('prior-years').disabled = mpaaTriggered;
  years.forEach(({ unused, member }) => { unused.disabled = !member.checked; });
  const taxRate = Number(byId('tax-rate').value);
  let estimate;
  try {
    estimate = calculatePension({
      earnings: byId('earnings').valueAsNumber,
      thresholdIncome: byId('threshold-income').valueAsNumber,
      adjustedIncome: byId('adjusted-income').valueAsNumber,
      personal: byId('personal').valueAsNumber,
      employer: byId('employer').valueAsNumber,
      prior: years.map(({ unused, member }) => ({
        unused: unused.valueAsNumber,
        member: member.checked,
      })),
      mpaaTriggered,
      taxRate,
    });
  } catch (error) {
    errorOutput.textContent = error.message;
    errorOutput.hidden = false;
    result.hidden = true;
    return;
  }

  byId('annual-label').textContent = estimate.currentYearAA === 60000
    ? 'Standard annual allowance'
    : 'Tapered annual allowance';
  byId('charge-label').textContent = taxRate === 60
    ? 'Illustrative cost at 60%'
    : `Estimated charge at ${taxRate}%`;
  setAmount('annual', estimate.currentYearAA);
  setAmount('dc', estimate.dcAllowance);
  setAmount('carry', estimate.carryForwardAvailable);
  setAmount('total-allowance', estimate.totalAllowance);
  setAmount('total-input', estimate.totalInput);
  setAmount('maximum', estimate.maximumTaxRelievedTotal);
  setAmount('remaining', estimate.unusedAllowance);
  setAmount('excess', estimate.excess);
  setAmount('charge', estimate.estimatedCharge);
  estimate.carryForward.forEach(({ used, remaining }, index) => {
    years[index].used.textContent = gbp.format(used);
    years[index].left.textContent = gbp.format(remaining);
  });

  byId('dc-row').hidden = !mpaaTriggered;
  byId('mpaa-warning').hidden = !mpaaTriggered;
  byId('carry-breakdown').hidden = mpaaTriggered;
  byId('employer-warning').hidden = estimate.maximumTaxRelievedTotal !== null;
  const earningsWarning = byId('earnings-warning');
  earningsWarning.hidden = estimate.personalOverEarnings === 0;
  earningsWarning.textContent = estimate.personalOverEarnings > 0
    ? `Your gross personal contributions exceed 100% of relevant UK earnings by ${gbp.format(estimate.personalOverEarnings)}. Employer contributions are outside this earnings cap.`
    : '';
  const chargeWarning = byId('charge-warning');
  chargeWarning.hidden = estimate.excess === 0;
  chargeWarning.textContent = estimate.excess > 0
    ? `Your plan exceeds available allowance by ${gbp.format(estimate.excess)}. Check your pension statements and income tax bands before making the payment.`
    : '';

  errorOutput.hidden = true;
  result.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
