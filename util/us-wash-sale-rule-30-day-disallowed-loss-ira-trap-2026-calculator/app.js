import { calculateWashSale } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const status = byId('status');
const error = byId('error');
const replacementDate = byId('replacementDate');
const replacementPrice = byId('replacementPrice');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const unitPrice = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 8,
});
const quantity = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 15 });
const moneyResults = [
  'totalRealizedLoss', 'disallowedLoss', 'currentlyDeductibleLoss', 'deferredTaxBenefit',
  'permanentTaxBenefitLost', 'lossOffsettingCapGains', 'remainingNetLoss', 'ordinaryIncomeLimit',
  'ordinaryIncomeDeduction', 'capitalLossCarryforward',
];

const readNumber = id => byId(id).valueAsNumber;
const show = (id, value) => { byId(id).textContent = value; };

function render(result, taxable) {
  for (const id of moneyResults) show(id, currency.format(result[id]));
  show('window', result.windowStart + ' to ' + result.windowEnd);
  show('safeRepurchaseDate', result.safeRepurchaseDate);
  const offset = result.dayOffset;
  show('dayOffset', offset === null ? '—' : (offset > 0 ? '+' : '') + offset + ' days');
  show('washShares', quantity.format(result.washShares));
  show('realizedLossPerShare', unitPrice.format(result.realizedLossPerShare));
  show('basisLabel', taxable ? 'Adjusted basis per matched share' : 'Purchase price per matched IRA share');
  show('adjustedBasisPerWashShare', result.adjustedBasisPerWashShare === null
    ? '—'
    : unitPrice.format(result.adjustedBasisPerWashShare));
  show('tackedHoldingDays', quantity.format(result.tackedHoldingDays));
  show('tackedHoldingDate', result.tackedHoldingDate ?? '—');
  show('form8949Adjustment', result.form8949Adjustment > 0
    ? '+' + currency.format(result.form8949Adjustment)
    : '—');

  if (result.totalRealizedLoss === 0) {
    status.textContent = 'This sale has no realized loss to evaluate.';
  } else if (result.washShares === 0) {
    status.textContent = 'The entered trades have no matched wash sale shares.';
  } else {
    const coverage = result.washShares === readNumber('sharesSold') ? 'Full' : 'Partial';
    const treatment = taxable
      ? 'The matched loss increases the taxable replacement basis.'
      : 'The matched loss is permanently disallowed under the IRA rule.';
    status.textContent = coverage + ' wash sale. ' + treatment;
  }
}

function update() {
  const replacementShares = readNumber('replacementShares');
  const noReplacement = replacementShares === 0;
  replacementDate.disabled = noReplacement;
  replacementPrice.disabled = noReplacement;
  replacementDate.required = !noReplacement;
  const accountType = byId('accountType').value;
  let result;
  try {
    result = calculateWashSale({
      saleDate: byId('saleDate').value,
      replacementDate: replacementDate.value,
      sharesSold: readNumber('sharesSold'),
      origBuyPrice: readNumber('origBuyPrice'),
      salePrice: readNumber('salePrice'),
      replacementShares,
      replacementPrice: noReplacement ? 0 : readNumber('replacementPrice'),
      accountType,
      origDaysHeld: readNumber('origDaysHeld'),
      otherCapGains: readNumber('otherCapGains'),
      marginalTaxRate: readNumber('marginalTaxRate'),
      marriedFilingSeparately: byId('marriedFilingSeparately').checked,
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.hidden = false;
    error.textContent = issue.message;
    results.hidden = true;
    status.textContent = 'Update the trade inputs to see your estimate.';
    return;
  }

  error.textContent = '';
  error.hidden = true;
  render(result, accountType === 'taxable_brokerage');
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
