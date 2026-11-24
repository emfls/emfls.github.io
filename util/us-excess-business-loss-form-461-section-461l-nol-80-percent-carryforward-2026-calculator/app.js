import { calculate } from './model.mjs';

const form = document.querySelector('#loss-calculator');
const error = document.querySelector('#calc-error');
const results = document.querySelector('#live-results');
const timing = document.querySelector('#timing-table');
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0,
});

function readAmount(id) {
  return form.elements.namedItem(id).valueAsNumber;
}

function showAmount(id, amount) {
  document.getElementById(id).textContent = currency.format(amount);
}

function render() {
  try {
    const estimate = calculate({
      filingStatus: form.elements.namedItem('filing-status').value,
      businessIncome: readAmount('business-income'),
      businessDeductions: readAmount('business-deductions'),
      bonusDepreciation: readAmount('bonus-depreciation'),
      nonBusinessTaxableIncome: readAmount('nonbusiness-income'),
      marginalRate: readAmount('marginal-rate'),
      futureTaxableIncome: [2027, 2028, 2029].map(year => readAmount(`income-${year}`)),
    });
    const yearTwo = estimate.years[0];
    showAmount('threshold', estimate.threshold);
    showAmount('net-business-loss', estimate.netBusinessLoss);
    showAmount('allowed-loss', estimate.allowableCurrentYearLossOffset);
    showAmount('used-loss', estimate.currentYearLossUsed);
    showAmount('deferred-loss', estimate.disallowedExcessBusinessLoss);
    showAmount('cash-tax-shock', estimate.cashTaxShock);
    showAmount('bonus-deferral', estimate.bonusDrivenDeferral);
    showAmount('bonus-shock', estimate.bonusDrivenCashTaxShock);
    showAmount('year-two-used', yearTwo.nolUsed);
    showAmount('year-two-remaining', yearTwo.remainingNol);
    showAmount('timing-2026-deduction', estimate.currentYearLossUsed);
    showAmount('timing-2026-taxable', estimate.taxableIncomeWithLimit);
    showAmount('timing-2026-carry', estimate.disallowedExcessBusinessLoss);
    for (const row of estimate.years) {
      showAmount(`timing-${row.year}-deduction`, row.nolUsed);
      showAmount(`timing-${row.year}-taxable`, row.taxableIncomeAfterNol);
      showAmount(`timing-${row.year}-carry`, row.remainingNol);
    }
    error.textContent = '';
    results.hidden = false;
    timing.hidden = false;
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    results.hidden = true;
    timing.hidden = true;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('reset', () => queueMicrotask(render));
render();
