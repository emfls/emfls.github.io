import { calculateEspp } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('espp-form');
const results = byId('results');
const error = byId('input-error');
const niitInputs = byId('niit-inputs');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const unitMoney = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 6,
});
const number = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const rows = Array.from(results.querySelectorAll('[data-row]'), (row) => ({
  key: row.dataset.row,
  cells: row.querySelectorAll('td'),
}));
const moneyText = (value) => money.format(Math.abs(value) < 0.005 ? 0 : value);
const dateText = (value) => date.format(new Date(value));
const qualificationText = (disposition) => disposition.qualifying ? 'Qualifying' : 'Disqualifying';
const termText = (disposition) => disposition.longTerm ? 'Long-term' : 'Short-term';

function setText(id, value) {
  const target = byId(id);
  if (target.textContent !== value) target.textContent = value;
}

function showNotice(id, message) {
  setText(id, message);
  byId(id).hidden = !message;
}

function readInputs() {
  if (byId('transferDate').validity.badInput) throw new RangeError('Complete the transfer date or clear it.');
  const input = {};
  for (const element of form.querySelectorAll('input, select')) {
    if (element.type === 'number') input[element.id] = element.valueAsNumber;
    else if (element.type === 'checkbox') input[element.id] = element.checked;
    else if (element.tagName === 'SELECT' && element.id !== 'filingStatus') input[element.id] = Number(element.value);
    else input[element.id] = element.value;
  }
  return input;
}

function cellText(scenario, key) {
  if (key === 'saleDate') return dateText(scenario.saleDate);
  if (key === 'disposition') return qualificationText(scenario);
  if (key === 'capitalTerm') return termText(scenario);
  if (key === 'returnOnContribution') return percent.format(scenario.returnOnContribution / 100);
  return moneyText(scenario[key]);
}

function render(input, model) {
  const { actual, hold, elapsedDayCheck } = model;
  for (const { key, cells } of rows) {
    cells[0].textContent = cellText(actual, key);
    cells[1].textContent = cellText(hold, key);
  }
  setText('qualifying-date', dateText(model.qualifyingDate));
  setText('tax-savings', model.taxSavings < -0.005
    ? `${moneyText(-model.taxSavings)} more tax`
    : moneyText(model.taxSavings));
  setText('purchase-price', unitMoney.format(model.purchasePrice));
  setText('lookback-savings', moneyText(model.lookbackSavings));
  setText('contribution', moneyText(model.contribution));
  setText('share-limit', number.format(model.annualShareLimit));
  setText('result-status', `${qualificationText(actual)} disposition. Entered sale estimated tax is ${moneyText(actual.totalTax)}.`);

  const elapsedQualifying = elapsedDayCheck.qualifying ? 'qualifying' : 'disqualifying';
  const elapsedTerm = elapsedDayCheck.longTerm ? 'long-term' : 'short-term';
  const transferDays = input.transferDate ? ` and ${number.format(model.daysFromTransfer)} since transfer` : '';
  const differs = elapsedDayCheck.qualifying !== actual.qualifying || elapsedDayCheck.longTerm !== actual.longTerm;
  setText('holding-days', `${number.format(model.daysFromGrant)} days since grant, ${number.format(model.daysFromPurchase)} since purchase${transferDays}. Fixed-day check (>730 and >365): ${elapsedQualifying}, ${elapsedTerm}.${differs ? ' The tax estimate uses calendar anniversaries and the transfer date.' : ''}`);
  showNotice('limit-warning', model.exceedsAnnualLimit
    ? `${number.format(input.shares)} shares exceed the single-year limit of ${number.format(model.annualShareLimit)} at grant-date FMV. Check the plan’s available accrual across calendar years and related-company plans.`
    : '');
  showNotice('year-warning', [actual, hold].some((scenario) => !scenario.saleDate.startsWith('2026-'))
    ? 'At least one sale date falls outside 2026. Its figures are a comparison at your 2026 assumptions. Actual tax depends on the year of sale.'
    : '');
  setText('niit-note', input.includeNiit
    ? `NIIT filing threshold: ${moneyText(model.niitThreshold)}. The estimate compares NIIT before and after the sale. Compensation can push MAGI above the threshold, and positive capital gain also adds to investment income.`
    : 'NIIT is excluded from this estimate.');
  showNotice('loss-note', actual.capitalGainOrLoss < 0 || hold.capitalGainOrLoss < 0
    ? `After offsetting capital gains, the annual net capital-loss deduction against other income is generally capped at ${moneyText(model.capitalLossLimit)} for your filing status. Excess loss can generally carry forward.`
    : '');
}

function update() {
  const showNiit = byId('includeNiit').checked;
  niitInputs.hidden = !showNiit;
  byId('baseMagi').disabled = !showNiit;
  byId('baseNii').disabled = !showNiit;
  try {
    const input = readInputs();
    render(input, calculateEspp(input));
    results.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    showNotice('input-error', problem.message);
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
