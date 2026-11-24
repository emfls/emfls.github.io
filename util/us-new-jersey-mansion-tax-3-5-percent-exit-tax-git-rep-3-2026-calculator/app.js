import { calculateClosingTaxes, priceCliff } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('sale-form');
const salePriceInput = byId('sale-price');
const gainInput = byId('gain');
const residentInput = byId('residency');
const section121Input = byId('section-121');
const taxableGainInput = byId('reportable-gain');
const estimatedTaxInput = byId('estimated-tax');
const error = byId('input-error');
const values = byId('result-values');
const priceCliffText = byId('price-cliff');
const defaultCliffText = priceCliffText.textContent;
const comparison = byId('guide-comparison');
const formatCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = amount => formatCurrency.format(amount);
const exemptionNotes = {
  resident: 'Box 1 applies when the seller remains an NJ resident and will file a resident return.',
  'low-consideration': 'Box 6 applies when total consideration is $1,000 or less.',
  'section-121': 'Box 2 screen passed. The inputs indicate a qualifying principal residence with no reportable gain.',
};

function render() {
  const resident = residentInput.value === 'resident';
  const salePrice = salePriceInput.valueAsNumber;
  const checkWithholding = !resident && !(salePrice > 0 && salePrice <= 1000);
  byId('section-121-group').hidden = !checkWithholding;
  byId('reportable-gain-group').hidden = !checkWithholding;
  byId('estimated-tax-group').hidden = !checkWithholding;

  try {
    const result = calculateClosingTaxes({
      salePrice,
      gain: gainInput.valueAsNumber,
      resident,
      section121: checkWithholding ? section121Input.value : 'none',
      taxableGain: checkWithholding && (taxableGainInput.value || taxableGainInput.validity.badInput)
        ? taxableGainInput.valueAsNumber : null,
      estimatedTax: checkWithholding && (estimatedTaxInput.value || estimatedTaxInput.validity.badInput)
        ? estimatedTaxInput.valueAsNumber : null,
    });
    const cliff = priceCliff(salePrice);

    byId('total').textContent = money(result.total);
    byId('mansion').textContent = `${money(result.mansion.fee)} · ${result.mansion.rate.toFixed(1)}%`;
    byId('transfer-fee').textContent = money(result.transferFee);
    byId('git-form').textContent = result.needsReview ? 'Confirm Box 2 eligibility' : result.form;
    byId('withholding').textContent = money(result.withholding);
    byId('refund').textContent = result.refund === null ? 'Enter estimated NJ tax' : money(result.refund);
    byId('form-note').textContent = result.exemption
      ? exemptionNotes[result.exemption]
      : result.needsReview
        ? 'The full-exclusion screen did not pass. The totals assume GIT/REP-1. Form GIT/REP-3 also addresses certain over-limit principal residence sales. Confirm treatment with your settlement agent.'
        : 'The closing payment is credited toward NJ income tax. A waiver or another seller assurance can affect what you pay.';
    comparison.hidden = Boolean(result.exemption);
    comparison.textContent = `Using the 8.97% rate in the NJ home-sale guide, the comparison estimate is ${money(result.guideComparison)}.`;

    priceCliffText.textContent = `At the threshold closest to your price, the fee rises from ${money(cliff.feeAtThreshold)} at ${formatPrice.format(cliff.threshold)} to ${money(cliff.feeAbove)} at ${formatPrice.format(cliff.threshold + 1)}. That extra $1 cuts proceeds by ${money(cliff.feeIncrease - 1)} after the mansion fee alone.`;
    error.hidden = true;
    error.textContent = '';
    values.hidden = false;
  } catch (err) {
    if (!(err instanceof RangeError)) throw err;
    error.textContent = err.message;
    error.hidden = false;
    values.hidden = true;
    priceCliffText.textContent = defaultCliffText;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
