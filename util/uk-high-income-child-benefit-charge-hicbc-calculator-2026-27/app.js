import { calculateHicbc } from './model.mjs';

const form = document.getElementById('hicbc-form');
const results = document.getElementById('hicbc-results');
const error = document.getElementById('hicbc-error');
const status = document.getElementById('hicbc-status');
const notes = document.getElementById('hicbc-notes');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const preciseGbp = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 4
});
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const preciseOutputs = new Set(['ani', 'householdAni', 'grossGiftAid']);
const outputs = results.querySelectorAll('[data-output]');
const numberInput = name => form.elements.namedItem(name).valueAsNumber;

function render() {
  const invalid = [...form.elements].find(field => !field.validity.valid);
  for (const field of form.elements) {
    if (field === invalid) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent}. ${invalid.validationMessage}`;
    error.hidden = false;
    results.hidden = true;
    status.textContent = '';
    return;
  }

  const partnerAni = numberInput('partnerAni');
  const estimate = calculateHicbc({
    grossTaxableIncome: numberInput('grossTaxableIncome'),
    grossPensionContributions: numberInput('grossPensionContributions'),
    netGiftAidDonations: numberInput('netGiftAidDonations'),
    partnerAni: Number.isNaN(partnerAni) ? null : partnerAni,
    children: numberInput('children'),
    weeks: numberInput('weeks')
  });

  for (const item of outputs) {
    const key = item.dataset.output;
    const amount = estimate[key];
    item.textContent = key.endsWith('Pct')
      ? percent.format(amount / 100)
      : (preciseOutputs.has(key) ? preciseGbp : gbp).format(amount);
  }

  const messages = [];
  if (partnerAni > 60_000) {
    messages.push(`Your partner’s ANI is ${gbp.format(partnerAni)}. Your contribution leaves their ANI unchanged, so their income can still trigger the charge.`);
  }
  if (estimate.benefit === 0) {
    messages.push('There is no Child Benefit to recover for the number of children and paid weeks entered.');
  } else if (estimate.chargePct === 0 && estimate.extraPension > 0) {
    messages.push('There is no current charge. The first 1% step starts at £60,200 of household ANI.');
  }
  if (estimate.ani >= 100_000) {
    messages.push('Personal Allowance taper can change your Income Tax saving at this income. The comparison still uses the stated 40% and 2% assumptions.');
  }

  notes.textContent = messages.join(' ');
  notes.hidden = messages.length === 0;
  error.hidden = true;
  results.hidden = false;
  status.textContent = `Estimated charge ${gbp.format(estimate.charge)}. Child Benefit kept ${gbp.format(estimate.benefitKept)}. Gross pension to reach £60,000 ${gbp.format(estimate.extraPension)}.`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();

for (const unit of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (unit.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
