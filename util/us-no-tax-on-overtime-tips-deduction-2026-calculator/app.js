import { calculate, employeeFica, overtimePremium } from './model.mjs';

const element = id => document.getElementById(id);
const filingInput = element('filing');
const methodInput = element('overtime-method');
const taxForm = element('tax-form');
const payrollForm = element('payroll-form');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = value => currency.format(value);
const range = (before, after, format) => `${format(before)} → ${format(after)}`;
const number = id => element(id).valueAsNumber;

function setFields(id, shown) {
  const group = element(id);
  group.hidden = !shown;
  for (const input of group.querySelectorAll('input')) input.disabled = !shown;
}

function showValidity(form, errorId, estimateId) {
  const invalid = form.querySelector(':invalid');
  element(errorId).textContent = invalid
    ? `${invalid.labels[0].textContent} — ${invalid.validationMessage}`
    : '';
  element(estimateId).hidden = Boolean(invalid);
  return !invalid;
}

function render(values) {
  for (const [id, value] of Object.entries(values)) element(id).textContent = value;
}

function updateTax() {
  const hourly = methodInput.value === 'hourly';
  setFields('hourly-fields', hourly);
  setFields('reported-fields', !hourly);
  if (!showValidity(taxForm, 'tax-error', 'estimate')) return;

  const filing = filingInput.value;
  const agi = number('agi');
  const magi = element('magi').value === '' ? agi : number('magi');
  const overtime = hourly ? overtimePremium(number('hourly-rate'), number('overtime-hours')) : number('overtime');
  const inputs = { filing, agi, magi, overtime, tips: number('tips') };
  const result = calculate(inputs);
  const comparison = calculate({ ...inputs, rounding: 'roundUp' });
  render({
    'tax-savings': money(result.taxSavings),
    'premium-used': money(overtime),
    'standard-deduction': money(result.standardDeduction),
    phaseout: money(result.reduction),
    'overtime-deduction': money(result.overtimeDeduction),
    'tips-deduction': money(result.tipsDeduction),
    'total-deduction': money(result.totalDeduction),
    'taxable-income': range(result.taxableBefore, result.taxableAfter, money),
    'income-tax': range(result.taxBefore, result.taxAfter, money),
    'effective-rate': range(result.effectiveBefore, result.effectiveAfter, percent.format),
    'rate-drop': `${(result.effectiveRateDrop * 100).toFixed(2)} pp`,
    'roundup-reduction': money(comparison.reduction),
    'roundup-deduction': money(comparison.totalDeduction),
    'roundup-savings': money(comparison.taxSavings)
  });
}

function updatePayroll() {
  const filing = filingInput.value;
  const joint = filing === 'mfj';
  setFields('spouse-fields', joint);
  if (!showValidity(payrollForm, 'payroll-error', 'payroll-estimate')) return;

  const primary = { socialSecurity: number('ss-wages'), medicare: number('medicare-wages') };
  const spouse = joint ? { socialSecurity: number('spouse-ss'), medicare: number('spouse-medicare') } : undefined;
  const result = employeeFica(filing, primary, spouse);
  render({
    'social-security-tax': money(result.socialSecurity),
    'medicare-tax': money(result.medicare),
    'additional-medicare-tax': money(result.additionalMedicare),
    'total-payroll-tax': money(result.total)
  });
}

taxForm.addEventListener('input', updateTax);
filingInput.addEventListener('input', updatePayroll);
payrollForm.addEventListener('input', updatePayroll);
for (const form of [taxForm, payrollForm]) {
  form.addEventListener('submit', event => event.preventDefault());
}
updateTax();
updatePayroll();

// A manual display unit needs a slot issued for this publisher.
const publisher = 'ca-pub-7974159843667565';
const ads = [...document.querySelectorAll(`ins.adsbygoogle[data-ad-client="${publisher}"][data-ad-slot]`)]
  .filter(ad => /^\d+$/.test(ad.dataset.adSlot));
if (ads.length === 2) {
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
  document.head.append(script);
  const queue = window.adsbygoogle ||= [];
  queue.push(...ads.map(() => ({})));
}
