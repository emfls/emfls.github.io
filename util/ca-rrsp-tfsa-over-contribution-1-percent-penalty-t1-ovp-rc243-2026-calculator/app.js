import { calculatePenalty } from './model.mjs';

const byId = (id) => document.getElementById(id);
const setText = (id, text) => { byId(id).textContent = text; };
const show = (id, visible) => { byId(id).hidden = !visible; };
const number = (id) => byId(id).valueAsNumber;
const checked = (id) => byId(id).checked;
const form = byId('penalty-form');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = (amount) => currency.format(amount);
const monthlyMoney = (amount, base) => amount === 0 && base > 0 ? 'Less than $0.01' : money(amount);

const accountAmounts = {
  rrsp: { room: '12500', contributions: '17000', months: '3' },
  tfsa: { room: '7000', contributions: '9000', months: '3' },
};
let previousAccount = 'rrsp';

function syncAccount(account) {
  if (account === previousAccount) return;
  for (const id of ['room', 'contributions', 'months']) {
    const field = byId(id);
    accountAmounts[previousAccount][id] = field.value;
    field.value = accountAmounts[account][id];
  }
  previousAccount = account;
}

function render() {
  const account = byId('account').value;
  syncAccount(account);
  const rrsp = account === 'rrsp';
  const corrected = rrsp && checked('corrected-before-end');
  const simulateWithdrawal = !rrsp && checked('simulate-withdrawal');
  const simulateNonResident = !rrsp && checked('simulate-non-resident');
  const filedLate = checked('filed-late');

  show('rrsp-fields', rrsp);
  show('tfsa-fields', !rrsp);
  show('duration-field', !corrected);
  show('withdrawal-fields', simulateWithdrawal);
  show('non-resident-fields', simulateNonResident);
  show('late-fields', filedLate);
  setText('room-help', rrsp
    ? 'Use the 2026 RRSP deduction limit on your CRA notice, before subtracting unused contributions.'
    : 'Use total room on January 1, including eligible prior-year withdrawals and unused room.');
  form.querySelector('label[for="room"]').textContent = rrsp
    ? 'Starting deduction limit (CAD)' : 'Starting contribution room (CAD)';
  setText('contributions-help', rrsp
    ? 'Use the calendar year. Enter prior unused amounts separately.'
    : 'Include contributions across all your TFSAs, including any same-year redeposit.');
  form.querySelector('label[for="months"]').textContent = rrsp
    ? 'Month-ends with the excess' : 'Calendar months in the scenario';
  setText('months-help', rrsp
    ? 'Count each 2026 month that ended with this balance still outstanding.'
    : 'Include the first month with the excess and each later 2026 month it remains, even for part of a month.');

  let result;
  try {
    result = calculatePenalty({
      account,
      room: number('room'),
      contributions: number('contributions'),
      months: corrected ? 0 : number('months'),
      age: byId('age').value,
      openingUnused: rrsp ? number('opening-unused') : 0,
      withdrawal: simulateWithdrawal ? number('withdrawal') : 0,
      redeposit: simulateWithdrawal ? number('redeposit') : 0,
      nonResidentAmount: simulateNonResident ? number('non-resident-amount') : 0,
      nonResidentMonths: simulateNonResident ? number('non-resident-months') : 0,
      nonResidentResolved: simulateNonResident && checked('non-resident-resolved'),
      filedLate,
      lateMonths: filedLate ? number('late-months') : 0,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    show('estimate', false);
    setText('result-announcement', '');
    setText('error', error.message);
    show('error', true);
    return;
  }

  show('error', false);
  show('estimate', true);
  show('ongoing-row', !rrsp && result.taxableBase !== result.excess);
  show('non-resident-row', simulateNonResident);
  show('trap-result', simulateWithdrawal);

  const taxType = rrsp ? 'Part X.1 tax' : 'Part XI.01 tax';
  setText('total-tax', money(result.totalTax));
  setText('result-context', `${taxType} before any late penalty or interest. File and pay by ${result.dueDate} if tax is due.`);
  setText('excess-label', corrected ? 'Total excess before correction' : 'Total excess remaining');
  setText('base-label', corrected ? 'Taxable base before correction' : rrsp ? 'Taxable penalty base' : 'First-month peak taxable base');
  setText('monthly-label', rrsp ? 'Monthly 1% excess tax' : 'First-month 1% excess tax');
  setText('excess', money(result.excess));
  setText('buffer', `${money(result.protectedExcess)} of ${money(result.buffer)}`);
  setText('taxable-base', money(result.taxableBase));
  setText('monthly-tax', monthlyMoney(result.monthlyTax, corrected ? 0 : result.taxableBase));
  setText('ongoing-tax', monthlyMoney(result.ongoingMonthlyTax, result.excess));
  setText('non-resident-tax', money(result.nonResidentTax));
  setText('late-penalty', money(result.latePenalty));
  setText('withdraw-now', money(result.withdrawNow));
  setText('withdraw-help', rrsp
    ? 'This amount removes the portion above the available cushion.'
    : simulateNonResident
      ? 'A designated withdrawal can cover both taxes if it clears the outstanding non-resident contribution and the TFSA excess. Check the designation on Schedule B.'
      : 'This amount removes the remaining excess. The current month’s peak can still be taxable.');
  if (simulateWithdrawal) {
    setText('trap-result', `The redeposit adds ${money(result.redepositExcess)} to the excess. Available 2026 room after these transactions is ${money(result.remainingRoom)}. The withdrawal could restore ${money(result.nextYearRestoration)} of room on January 1, 2027 if you qualify.`);
  }
  setText('result-announcement', `Estimated tax ${money(result.totalTax)}. Estimated withdrawal ${money(result.withdrawNow)}.`);
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
