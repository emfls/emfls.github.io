import { estimateDeathBenefit } from './model.mjs';

const form = document.getElementById('super-calculator');
const fields = form.elements;
const estimate = document.getElementById('estimate');
const error = document.getElementById('input-error');
const secondTsbField = document.getElementById('second-tsb-field');
const untaxedNotice = document.getElementById('untaxed-notice');
const cycleResults = document.getElementById('cycle-results');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format;
const amounts = ['totalBalance', 'taxFree', 'taxedElement', 'untaxedElement', 'priorTsb', 'secondTsb', 'withdrawal'];

function renderCycle(step, canWithdraw) {
  const { year, memberAge, cap, years, withdrawal, taxedWithdrawn, untaxedWithdrawn, taxAfter } = step;
  const period = years > 1 ? `${years}-year bring-forward` : years === 1 ? 'annual only' : 'no cap available';
  let summary;
  if (!step.eligibleAge) {
    summary = 'No recontribution modelled. Member age is outside the 60–74 model range.';
  } else if (!canWithdraw) {
    summary = 'No recontribution modelled. Unrestricted withdrawal access is unconfirmed.';
  } else {
    summary = `${money(withdrawal)} withdrawn and recontributed. ${money(taxedWithdrawn + untaxedWithdrawn)} shifts to the tax-free component. Death tax after this cycle is ${money(taxAfter)}.`;
  }
  const item = document.createElement('li');
  item.textContent = `${year}–${String(year + 1).slice(-2)} · Age ${memberAge} · TSB-based limit ${money(cap)} (${period}). ${summary}`;
  return item;
}

function update() {
  const cycles = Number(fields.cycles.value);
  secondTsbField.hidden = cycles !== 2;
  fields.secondTsb.disabled = cycles !== 2;
  const inputs = {
    ...Object.fromEntries(amounts.map(name => [name, fields[name].valueAsNumber])),
    age: fields.age.valueAsNumber,
    beneficiary: fields.beneficiary.value,
    canWithdraw: fields.canWithdraw.checked,
    cycles
  };

  let result;
  try {
    result = estimateDeathBenefit(inputs);
  } catch (issue) {
    estimate.hidden = true;
    error.textContent = issue.message;
    return;
  }

  const { taxBefore, taxAfter, taxSaved, estateSavingBefore, estateSavingAfter, finalComponents, steps } = result;
  document.getElementById('tax-before').textContent = money(taxBefore);
  document.getElementById('tax-after').textContent = money(taxAfter);
  document.getElementById('tax-saved').textContent = money(taxSaved);
  document.getElementById('estate-comparison').textContent = inputs.beneficiary === 'tax_dependant'
    ? 'Estate-route Medicare levy saving for a tax dependant is $0.00.'
    : `Via-estate Medicare levy saving compared with direct payment is ${money(estateSavingBefore)} before recontribution and ${money(estateSavingAfter)} after recontribution. This comparison uses the standard 2% levy on the taxable portions.`;
  document.getElementById('final-components').textContent =
    `Final components · ${money(finalComponents.taxFree)} tax-free · ${money(finalComponents.taxedElement)} taxed · ${money(finalComponents.untaxedElement)} untaxed.`;
  cycleResults.replaceChildren(...steps.map(step => renderCycle(step, inputs.canWithdraw)));
  const untaxedWithdrawn = steps.reduce((sum, step) => sum + step.untaxedWithdrawn, 0);
  untaxedNotice.hidden = untaxedWithdrawn === 0;
  untaxedNotice.textContent = untaxedNotice.hidden ? '' :
    `${money(untaxedWithdrawn)} of the gross withdrawals comes from the untaxed element. Member withdrawal tax may apply. The estimate assumes the full gross amount is put back and excludes that cost.`;
  error.textContent = '';
  estimate.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
