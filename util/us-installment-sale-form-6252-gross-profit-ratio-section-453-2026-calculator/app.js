import { calculateInstallmentSale } from './model.mjs';

const form = document.getElementById('sale-form');
const results = document.getElementById('results');
const problem = document.getElementById('problem');
const schedule = document.getElementById('schedule');
const inputs = Array.from(form.querySelectorAll('input[type="number"]'));
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 4 });
const money = value => currency.format(Math.round(value * 100) / 100 || 0);

function showText(id, text) {
  document.getElementById(id).textContent = text;
}

function render(result) {
  showText('ratio', percent.format(result.grossProfitRatio));
  showText('recapture-tax', money(result.recaptureTaxShock));
  showText('installment-tax', money(result.installmentTax));
  showText('lump-sum-tax', money(result.lumpSumTax));
  showText('tax-difference', money(result.taxSaved));
  showText('difference-summary',
    result.taxSaved >= .005 ? 'Lower estimated tax with installments'
      : result.taxSaved <= -.005 ? 'Higher estimated tax with installments' : 'Same estimated tax');
  showText('gross-profit', money(result.deferredGrossProfit));
  showText('contract-price', money(result.contractPrice));
  showText('seller-note', money(result.notePrincipal));

  const closing = result.rows[0];
  const shortfall = closing.tax - closing.cashPrincipal;
  showText('cash-warning', shortfall >= .005
    ? `Estimated 2026 federal tax exceeds the cash down payment by ${money(shortfall)}, before selling costs.`
    : `Estimated 2026 federal tax is ${money(closing.tax)} against ${money(closing.cashPrincipal)} cash received at closing, before selling costs.`);

  const rows = result.rows.map(data => {
    const row = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = data.year;
    row.append(year);
    const amounts = [
      data.cashPrincipal, data.deemedPrincipal, data.interest, data.capitalGain,
      data.gain1250, data.regularGain, data.recapture, data.niit, data.tax,
    ];
    for (const amount of amounts) {
      const cell = document.createElement('td');
      cell.textContent = money(amount);
      row.append(cell);
    }
    return row;
  });
  schedule.replaceChildren(...rows);
}

function calculate() {
  const badInput = inputs.find(input => !input.validity.valid);
  let result;
  let message = '';
  if (badInput) {
    message = `${badInput.labels[0].textContent}: ${badInput.validationMessage}`;
  } else {
    const numbers = Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]));
    try {
      result = calculateInstallmentSale({
        ...numbers,
        filingStatus: form.elements.filingStatus.value,
        saleSubjectToNiit: form.elements.saleSubjectToNiit.value === 'yes',
      });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      message = error.message;
    }
  }
  if (problem.textContent !== message) problem.textContent = message;
  results.hidden = !result;
  if (result) render(result);
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});
calculate();
