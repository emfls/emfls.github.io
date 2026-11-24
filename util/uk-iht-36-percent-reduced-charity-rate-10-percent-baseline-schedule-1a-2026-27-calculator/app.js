import { calculateIht } from './model.mjs';

const form = document.getElementById('iht-form');
const results = document.getElementById('results');
const error = document.getElementById('error');
const announcement = document.getElementById('announcement');
const pensionField = form.elements.namedItem('unusedPension');
const previewField = form.elements.namedItem('includePension');
const previewSummary = document.getElementById('preview-summary');
const topUpSummary = document.getElementById('top-up-summary');
const topUp = document.getElementById('top-up');
const cash = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const exactCash = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 3,
});
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 4 });
const money = (amount) => cash.format(amount);
const rate = (fraction) => percent.format(fraction);

function readAmount(name, emptyValue) {
  const field = form.elements.namedItem(name);
  return !field.validity.badInput && field.value === '' ? emptyValue : field.valueAsNumber;
}

function update() {
  pensionField.disabled = !previewField.checked;
  try {
    const inputs = {
      netFreeEstate: readAmount('netFreeEstate', NaN),
      unusedPension: previewField.checked ? readAmount('unusedPension', 0) : 0,
      includePension: previewField.checked,
      availableNrb: readAmount('availableNrb', NaN),
      residenceNrb: readAmount('residenceNrb', NaN),
      qualifyingHomeValue: readAmount('qualifyingHomeValue', null),
      plannedGift: readAmount('plannedGift', NaN),
    };
    const result = calculateIht(inputs);
    const summaries = {
      mode: inputs.includePension ? 'April 2027 pension preview' : '2026/27 calculation',
      baselineAmount: money(result.baselineAmount),
      giftTarget: money(result.requiredGift),
      appliedResidenceNrb: exactCash.format(result.appliedResidenceNrb),
      plannedRate: rate(result.planned.rate),
      plannedTaxSaved: money(result.plannedTaxSaved),
      thresholdTaxSaved: money(result.thresholdTaxSaved),
      thresholdCost: money(result.thresholdCostToHeirs),
      giftShare: result.plannedGiftPercent === null ? '—' : rate(result.plannedGiftPercent / 100),
      costShare: result.thresholdCostPercent === null ? '—' : rate(result.thresholdCostPercent / 100),
      qualification: result.baselineAmount === 0
        ? 'No positive baseline. The 10% target is £0 for these inputs.'
        : result.qualifies ? 'The planned legacy meets the 10% test.'
          : 'The planned legacy falls short of the 10% test.',
      thresholdDetail: result.requiredGift === result.exactThreshold ? ''
        : `Exact 10% is ${exactCash.format(result.exactThreshold)}. The payable target rounds up to the next penny.`,
    };
    for (const element of results.querySelectorAll('[data-summary]')) {
      element.textContent = summaries[element.dataset.summary];
    }
    for (const cell of results.querySelectorAll('[data-scenario]')) {
      const { scenario, metric } = cell.dataset;
      const value = result[scenario][metric];
      cell.textContent = metric === 'rate' ? rate(value) : exactCash.format(value);
    }

    topUp.hidden = result.topUp === null;
    if (result.topUp) {
      const { giftIncrease, taxSaved, heirsChange } = result.topUp;
      const familyOutcome = heirsChange > 0 ? `family heirs gain ${money(heirsChange)}`
        : heirsChange < 0 ? `family heirs receive ${money(-heirsChange)} less`
          : 'family heirs receive the same amount';
      topUpSummary.textContent = `Charity receives ${money(giftIncrease)} more, IHT falls by ${money(taxSaved)}, and ${familyOutcome}.`;
      document.getElementById('top-up-heading').textContent = result.bothGain
        ? 'Both family and charity gain by topping up' : 'Deed of Variation top-up comparison';
    }

    previewSummary.hidden = !inputs.includePension;
    if (inputs.includePension) {
      const current = calculateIht({ ...inputs, includePension: false, plannedGift: 0 });
      previewSummary.textContent = `Including ${money(result.pensionIncluded)} of pension changes the 10% gift target from ${money(current.requiredGift)} to ${money(result.requiredGift)} and changes no-gift IHT from ${money(current.noGift.tax)} to ${money(result.noGift.tax)}.`;
    }
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
    announcement.textContent = `${summaries.mode}. Gift target ${summaries.giftTarget}. Planned IHT ${money(result.planned.tax)}. ${summaries.qualification}`;
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    results.hidden = true;
    announcement.textContent = '';
    error.textContent = exception.message;
    error.hidden = false;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
update();
