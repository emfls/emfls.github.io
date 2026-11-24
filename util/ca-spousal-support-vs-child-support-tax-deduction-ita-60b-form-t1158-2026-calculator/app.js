import { calculateSupport, PERIODIC } from './model.mjs';

const form = document.querySelector('#support-form');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const alert = document.querySelector('#priority-alert');
const excluded = document.querySelector('#excluded-transfer');
const amount = (name) => form.elements.namedItem(name).valueAsNumber;
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = (value) => currency.format(Math.abs(value) < 0.005 ? 0 : value);
const fields = [...results.querySelectorAll('[data-value]')];

function render() {
  const structure = form.elements.structure.value;
  const periodic = structure === PERIODIC;
  form.elements.monthlySpousal.disabled = !periodic;
  try {
    const result = calculateSupport({
      province: form.elements.province.value,
      structure,
      monthlyChild: amount('monthlyChild'),
      monthlySpousal: periodic ? amount('monthlySpousal') : 0,
      actualPaid: amount('actualPaid'),
      priorChildArrears: amount('priorChildArrears'),
      payerIncome: amount('payerIncome'),
      recipientIncome: amount('recipientIncome'),
    });

    for (const field of fields) field.textContent = money(result[field.dataset.value]);
    if (result.childShortfall > 0) {
      alert.textContent = 'Child support priority: ' + money(result.childShortfall)
        + ' of the modelled child support remains unpaid. The estimated spousal deduction is $0.';
    } else if (periodic && result.spousalShortfall > 0) {
      alert.textContent = 'After child support priority, ' + money(result.line22000)
        + ' of the ' + money(result.scheduledSpousalAnnual) + ' scheduled spousal support is deductible in this estimate.';
    } else {
      alert.textContent = '';
    }

    excluded.textContent = result.excludedTransfer > 0
      ? money(result.excludedTransfer) + (periodic
        ? ' above the entered support obligation is included in cash flow only.'
        : ' of the cash transfer is treated as a non-qualifying spousal settlement.')
      : '';
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    alert.textContent = '';
    results.hidden = true;
    error.textContent = 'Enter a value from $0 to $1 billion in each active amount field, with up to two decimal places.';
  }
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
