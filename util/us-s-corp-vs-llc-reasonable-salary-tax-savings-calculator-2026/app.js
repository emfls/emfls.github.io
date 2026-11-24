import { compareTaxes, breakEvenProfit, MAX_AMOUNT } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('tax-form');
const fields = form.elements;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const moneyFields = [...form.querySelectorAll('input[type="number"]')];
const comparisonRows = [
  'salary', 'employerFica', 'employeeFica', 'passThrough', 'halfSeTaxDeduction', 'beforeQbi',
  'qbi', 'deduction', 'taxableIncome', 'incomeTax', 'payroll', 'additionalMedicare', 'overhead', 'total'
];

function displayMoney(id, amount) {
  byId(id).textContent = amount == null ? '—' : money.format(Math.abs(amount) < 0.005 ? 0 : amount);
}

function render() {
  const jointReturn = fields.status.value === 'mfj';
  byId('spouse-field').hidden = !jointReturn;
  fields.spouseWages.disabled = !jointReturn;

  for (const field of moneyFields) {
    const invalid = !field.disabled && !field.validity.valid;
    if (invalid) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
  const error = byId('error');
  const invalid = moneyFields.some(field => !field.disabled && !field.validity.valid);
  error.hidden = !invalid;
  byId('results').hidden = invalid;
  byId('loss-note').hidden = true;
  if (invalid) {
    error.textContent = 'Enter each amount from $0 to $10,000,000 with up to two decimal places.';
    return;
  }

  const inputs = {
    ...Object.fromEntries(moneyFields.map(field => [field.name, field.disabled ? 0 : field.valueAsNumber])),
    status: fields.status.value,
    sstb: fields.sstb.checked,
    materiallyParticipates: fields.materiallyParticipates.checked
  };
  const result = compareTaxes(inputs);
  const { llc, sCorp, netSavings, shortfall, salaryRatio, qbiSavingsEffect } = result;
  displayMoney('savings', netSavings);
  byId('savings-card').dataset.outcome = netSavings < -0.005 ? 'loss' : '';
  byId('savings-note').textContent = shortfall > 0
    ? `Profit falls ${money.format(shortfall)} short of funding salary, employer FICA, and overhead.`
    : 'After employment taxes, regular federal income tax, QBI, and annual overhead.';

  const breakEven = breakEvenProfit(inputs);
  byId('break-even').textContent = breakEven === null ? '—' : wholeDollars.format(breakEven);
  byId('break-even-note').textContent = inputs.salary === 0
    ? 'Enter a market-supported salary to estimate break-even.'
    : breakEven === null
      ? `No funded break-even through ${wholeDollars.format(MAX_AMOUNT)} at this salary.`
      : 'First whole-dollar profit with zero or positive savings at this salary.';

  byId('salary-ratio').textContent = salaryRatio === null ? '—' : percent.format(salaryRatio);
  const meter = byId('salary-meter');
  meter.hidden = salaryRatio === null;
  meter.value = Math.min(1, salaryRatio ?? 0);
  meter.setAttribute('aria-valuetext', salaryRatio === null ? 'Unavailable' : percent.format(salaryRatio));
  byId('salary-review-note').textContent = inputs.salary === 0 && inputs.profit > 0
    ? 'Review required. The scenario pays zero wages to the owner.'
    : shortfall > 0
      ? 'Funding shortfall. Review the salary and available cash.'
      : 'Compare the proposed pay with local market rates for the work performed.';

  displayMoney('qbi-effect', qbiSavingsEffect);
  const llcRows = { ...llc, overhead: 0 };
  const sCorpRows = { ...sCorp, salary: inputs.salary, additionalMedicare: sCorp.employeeAdditionalMedicare };
  if (shortfall > 0) sCorpRows.passThrough = null;
  for (const key of comparisonRows) {
    displayMoney(`llc-${key}`, llcRows[key]);
    displayMoney(`sCorp-${key}`, sCorpRows[key]);
  }
  if (netSavings < -0.005) {
    byId('loss-note').textContent = `At your inputs, the S corporation would cost ${money.format(-netSavings)} more each year.`;
    byId('loss-note').hidden = false;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();

// Queue display ads when this publisher's authorized ad-unit IDs are supplied.
for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (slot.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
