import { calculateAcaCliff } from './model.mjs';

const form = document.getElementById('aca-form');
const results = document.getElementById('aca-results');
const error = document.getElementById('aca-error');
const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percentFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
const returnFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = value => moneyFormat.format(value);
const amount = name => form.elements.namedItem(name).valueAsNumber;
const show = (name, value) => { document.getElementById(name).textContent = value; };

function showError(message) {
  error.textContent = message;
  error.hidden = false;
  results.hidden = true;
}

function update() {
  const invalid = [...form.querySelectorAll('input')].find(input => !input.validity.valid);
  if (invalid) {
    showError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    return;
  }

  let estimate;
  try {
    estimate = calculateAcaCliff({
      householdSize: amount('household'),
      region: form.elements.region.value,
      magi: amount('magi'),
      annualBenchmarkPremium: amount('benchmark'),
      availableContribution: amount('available'),
      marginalTaxRatePercent: amount('tax-rate'),
    });
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    showError(exception.message);
    return;
  }

  show('income-position', `${percentFormat.format(estimate.fplPercent)}% of FPL`);
  show('threshold', money(estimate.cliff));
  show('contribution-rate', estimate.aboveCliff || estimate.belowFpl
    ? 'Outside modeled income range'
    : `${percentFormat.format(estimate.applicableRate * 100)}%`);
  show('annual-ptc', money(estimate.annualPtc));
  show('net-monthly', money(estimate.netMonthlyPremium));
  show('cliff-loss', money(estimate.cliffLoss));
  show('exact-minimum', money(estimate.minimumContribution));
  show('rescue-target', money(estimate.rescueTarget));
  show('buffered-amount', money(estimate.bufferedContribution));
  show('rescue-ptc', estimate.rescuePtc === null ? '—' : money(estimate.rescuePtc));
  show('tax-savings', estimate.taxSavings === null ? '—' : money(estimate.taxSavings));
  show('effective-return', estimate.effectiveReturnPercent === null
    ? '—'
    : `${returnFormat.format(estimate.effectiveReturnPercent)}%`);

  let status = 'Your MAGI is within the modeled income range. No cliff rescue is needed.';
  if (estimate.belowFpl) {
    status = 'Your MAGI is below 100% of FPL. Check Marketplace exceptions and Medicaid eligibility.';
  } else if (estimate.aboveCliff) {
    if (estimate.rescuePtc === 0) {
      status = 'At the buffered target, the benchmark premium is still too low to produce a federal credit.';
    } else if (estimate.minimumShortfall > 0) {
      status = `Your available amount is ${money(estimate.minimumShortfall)} short of the cutoff. The buffered savings below assume you can make the full contribution.`;
    } else if (estimate.bufferedShortfall > 0) {
      status = `Your available amount reaches the legal cutoff. The one-dollar buffer requires ${money(estimate.bufferedShortfall)} more.`;
    } else {
      status = 'Your stated available amount covers the buffered target, assuming the contribution qualifies and reduces MAGI dollar for dollar.';
    }
  }
  show('rescue-status', status);
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => { event.preventDefault(); });
update();
