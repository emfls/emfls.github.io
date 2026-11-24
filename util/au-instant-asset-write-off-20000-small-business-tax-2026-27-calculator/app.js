import { calculateWriteOff } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const error = byId('error');
const rows = byId('schedule-rows');
const number = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const aud = value => value === null ? '—' : 'A$' + number.format(value);

const verdicts = {
  instant: 'Qualifies for the instant asset write-off',
  pool: 'Small business pool · 15% initial rate',
  turnover: 'Outside simplified depreciation · turnover is A$10 million or more',
  private: 'No business deduction · 0% business use',
};

function render() {
  const entity = byId('entity').value;
  byId('medicare-field').hidden = entity !== 'sole';
  let estimate;
  try {
    estimate = calculateWriteOff({
      turnover: byId('turnover').valueAsNumber,
      gstRegistered: byId('gst').value === 'yes',
      assetCost: byId('asset-cost').valueAsNumber,
      businessUse: byId('business-use').valueAsNumber,
      quantity: byId('quantity').valueAsNumber,
      entity,
      taxableIncome: byId('taxable-income').valueAsNumber,
      fullMedicare: byId('medicare').value === 'full',
    });
    if (form.querySelector('input:invalid')) {
      throw new RangeError('Use whole numbers for quantity and up to two decimal places for prices, income and percentages.');
    }
  } catch (issue) {
    error.textContent = issue.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  byId('verdict').textContent = verdicts[estimate.status];
  byId('threshold-cost').textContent = aud(estimate.thresholdCost);
  byId('deduction').textContent = aud(estimate.yearOneDeduction);
  byId('gst-credit').textContent = aud(estimate.gstCredit);
  byId('tax-saving').textContent = aud(estimate.taxSaving);
  byId('net-cash').textContent = aud(estimate.netCashCost);
  byId('purchase-total').textContent = aud(estimate.grossCost);

  let explanation = '';
  if (estimate.status === 'turnover') {
    explanation = 'The GST estimate still applies. The deduction and cash figures require a different depreciation method.';
  } else if (estimate.schedule[0].clearsPool) {
    explanation = 'The modelled pool is below A$20,000 before depreciation, so the whole pool is deducted in year 1.';
  } else if (estimate.yearOneDeduction > 0 && estimate.taxSaving === 0) {
    explanation = 'This deduction produces no current income-tax saving at the income entered.';
  }
  byId('result-note').textContent = explanation;
  byId('result-note').hidden = !explanation;
  byId('schedule').hidden = estimate.schedule.length === 0;
  rows.replaceChildren(...estimate.schedule.map(row => {
    const tr = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = `Year ${row.year}`;
    tr.append(year);
    for (const value of [row.deduction, row.balance, row.rateOnlyDeduction, row.rateOnlyBalance]) {
      const td = tr.insertCell();
      td.textContent = aud(value);
    }
    if (row.clearsPool) tr.cells[1].append(' (pool cleared)');
    return tr;
  }));
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
