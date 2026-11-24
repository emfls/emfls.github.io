import { estimateEI } from './model.mjs';

const form = document.getElementById('ei-form');
const error = document.getElementById('estimate-error');
const status = document.getElementById('claim-status');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const whole = new Intl.NumberFormat('en-CA');
const inputs = {
  averageWeeklyEarnings: 'average-earnings',
  regionalRate: 'regional-rate',
  hours: 'hours',
  weeklyWorkEarnings: 'work-earnings',
  weeksInTaxYear: 'weeks',
  netIncome: 'net-income',
  regularEIOverride: 'actual-ei',
};
const toggles = {
  fullWorkWeek: 'full-week',
  waitingPeriodWaived: 'waiver',
  firstTimeExempt: 'exempt',
};
const outputs = {
  baseWeeklyBenefit: 'base-benefit',
  earningsCap: 'earnings-cap',
  weeklyDeduction: 'weekly-deduction',
  weeklyBenefit: 'weekly-benefit',
  bestWeeks: 'best-weeks',
  requiredHours: 'required-hours',
  payableWeeks: 'payable-weeks',
  waitingWeeks: 'waiting-weeks',
  weeksPaid: 'weeks-paid',
  projectedEI: 'projected-ei',
  regularEI: 'repayment-ei',
  clawback: 'clawback',
  eiAfterRepayment: 'after-repayment',
  rrspDeductionNeeded: 'rrsp-deduction',
};
const counts = new Set(['bestWeeks', 'requiredHours', 'payableWeeks', 'waitingWeeks', 'weeksPaid']);

function scenario() {
  const values = {};
  let invalidField;
  for (const [key, id] of Object.entries(inputs)) {
    const field = document.getElementById(id);
    if (field.validity.valid) {
      field.removeAttribute('aria-invalid');
    } else {
      field.setAttribute('aria-invalid', 'true');
      invalidField ??= field;
    }
    values[key] = key === 'regularEIOverride' && field.value === '' ? null : field.valueAsNumber;
  }
  if (invalidField) {
    throw new RangeError(`${invalidField.labels[0].textContent}. ${invalidField.validationMessage}`);
  }
  for (const [key, id] of Object.entries(toggles)) {
    values[key] = document.getElementById(id).checked;
  }
  return values;
}

function render(result) {
  for (const [key, id] of Object.entries(outputs)) {
    const formatted = result ? (counts.has(key) ? whole : money).format(result[key]) : '—';
    const output = document.getElementById(id);
    if (output.textContent !== formatted) output.textContent = formatted;
  }
}

function update() {
  try {
    const values = scenario();
    const result = estimateEI(values);
    error.textContent = '';
    render(result);

    let message = '';
    if (!result.payableWeeks) {
      message = 'You are below the standard regional hours requirement.';
    } else if (values.fullWorkWeek) {
      message = 'Full work weeks pay no EI and do not count against your payable weeks.';
    } else if (!result.weeklyBenefit) {
      message = 'The weekly earnings entered leave no payable EI in this projection.';
    }
    status.textContent = message;
    status.hidden = !message;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    status.hidden = true;
    render(null);
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
