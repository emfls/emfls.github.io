import { calculateMaternity, LOWER_EARNINGS_LIMIT } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('leave-form');
const earnings = byId('earnings');
const value = id => byId(id).value;
const number = id => byId(id).valueAsNumber;
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const signed = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', signDisplay: 'exceptZero' });
const aweMoney = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 6 });
const days = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const cashColumns = ['smp', 'topUp', 'kit', 'gross', 'tax', 'ni', 'pension', 'net'];
let previousMode = value('pay-mode');

function setFields(id, enabled) {
  const group = byId(id);
  group.hidden = !enabled;
  for (const input of group.querySelectorAll('input')) input.disabled = !enabled;
}

function addRow(container, title, cash, change, unpaid = false) {
  const row = container.insertRow();
  row.classList.toggle('unpaid', unpaid);
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = title;
  row.append(heading);
  for (const key of cashColumns) row.insertCell().textContent = gbp.format(cash[key]);
  const delta = row.insertCell();
  delta.textContent = change === null ? '—' : signed.format(change);
  delta.classList.toggle('drop', change < 0);
}

function update() {
  const mode = value('pay-mode');
  const weekly = mode === 'weekly';
  if (mode !== previousMode) {
    if (Number.isFinite(earnings.valueAsNumber)) {
      const converted = weekly ? number('earnings') / 52 : number('earnings') * 52;
      earnings.value = converted.toFixed(2);
    }
    previousMode = mode;
  }
  earnings.max = weekly ? '1000000' : '52000000';
  byId('earnings-label').textContent = weekly ? 'Average weekly earnings (£)' : 'Gross annual salary (£)';
  setFields('awe-fields', !weekly);
  const custom = value('policy') === 'custom';
  setFields('enhanced', custom);
  setFields('kit-details', number('kit-days') > 0);

  const error = byId('input-error');
  try {
    const invalid = [...form.elements].find(input => input.willValidate && !input.validity.valid);
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent.trim()} — ${invalid.validationMessage}`);

    const annualSalary = weekly ? number('earnings') * 52 : number('earnings');
    const awe = weekly ? number('earnings') : value('awe') ? number('awe') : annualSalary / 52;
    const leaveWeeks = number('leave-weeks');
    const workdays = number('workdays');
    const service = value('service');
    const result = calculateMaternity({
      annualSalary, awe, leaveWeeks, workdays, serviceMet: service === 'yes',
      frequency: value('frequency'), holidayDays: number('holiday'), pensionPercent: number('pension'),
      fullWeeks: custom ? number('full-weeks') : 0, halfWeeks: custom ? number('half-weeks') : 0,
      kitDays: number('kit-days'), kitStartWeek: number('kit-week'),
      kitDayPay: value('kit-pay') ? number('kit-pay') : annualSalary / 52 / workdays,
    });

    error.hidden = true;
    error.textContent = '';
    byId('eligibility').hidden = result.eligible;
    if (!result.eligible) {
      const reasons = [];
      if (awe < LOWER_EARNINGS_LIMIT) reasons.push('Your average weekly earnings are below the £129 eligibility threshold.');
      if (service === 'no') reasons.push('The qualifying-week service rule is not met.');
      if (service === 'unknown') reasons.push('The service requirement is unconfirmed. This scenario excludes SMP until you confirm eligibility.');
      byId('eligibility-message').textContent = reasons.join(' ');
    }

    byId('gross39').textContent = gbp.format(result.gross39);
    byId('gross52').textContent = gbp.format(result.gross52);
    byId('gross').textContent = gbp.format(result.totals.gross);
    byId('net').textContent = gbp.format(result.totals.net);
    byId('holiday-days').textContent = `${days.format(result.accruedDays)} days`;
    byId('holiday-value').textContent = gbp.format(result.holidayValue);
    byId('result-summary').textContent = `${leaveWeeks} weeks planned · ${aweMoney.format(awe)} AWE · ${result.eligible ? 'SMP included if notice and proof requirements are met' : 'SMP excluded'}`;

    const months = byId('months');
    months.replaceChildren();
    let previous = result.normalMonthlyNet;
    for (const month of result.months) {
      const onLeave = (month.month - 1) * 13 < leaveWeeks * 3;
      const change = Math.round((month.net - previous) * 100) / 100;
      addRow(months, onLeave ? `Month ${month.month}` : `Month ${month.month} (after leave)`,
        month, onLeave ? change : null, onLeave && month.gross === 0);
      previous = month.net;
    }
    const totals = byId('totals');
    totals.replaceChildren();
    addRow(totals, 'Leave total', result.totals, null);
    const shortfall = Math.max(0, result.normalMonthlyNet * 12 * leaveWeeks / 52 - result.totals.net);
    byId('cash-warning').textContent = shortfall > 0
      ? `Estimated take-home shortfall over your planned leave versus normal pay: ${gbp.format(shortfall)}.`
      : 'Estimated take-home for this plan matches or exceeds normal pay for the same period.';
    byId('results').hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    byId('results').hidden = true;
    byId('eligibility').hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('change', update);
update();
