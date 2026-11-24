import { calculateDeduction } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('deduction-form');
const error = byId('error');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const rate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const reasonLabels = { mfs: 'married filing separately', dependent: 'claimed as a dependent' };

function optionalNumber(id, fallback) {
  const input = byId(id);
  return input.value === '' ? fallback : input.valueAsNumber;
}

function render() {
  const invalidField = Array.from(form.elements).find((field) => !field.validity.valid);
  try {
    if (invalidField) {
      throw new RangeError(`${invalidField.labels[0].textContent}. ${invalidField.validationMessage}`);
    }
    const result = calculateDeduction({
      filingStatus: byId('filing-status').value,
      dependent: byId('dependent').value === 'yes',
      interestPaid: byId('interest').valueAsNumber,
      magi: byId('magi').valueAsNumber,
      federalRate: Number(byId('federal-rate').value),
      stateRate: byId('state-rate').valueAsNumber,
      contribution: optionalNumber('contribution', 0),
      loanRate: optionalNumber('loan-rate', null),
    });

    const outputs = {
      deduction: money.format(result.allowedDeduction),
      'phaseout-loss': money.format(result.phaseoutLoss),
      'tax-savings': money.format(result.totalSavings),
      'extra-savings': money.format(result.extraSavings),
      'after-tax-rate': result.afterTaxRate === null ? '—' : `${rate.format(result.afterTaxRate)}%`,
      'rate-relief': result.rateRelief === null ? '—' : `${rate.format(result.rateRelief)} percentage points`,
    };
    for (const [id, value] of Object.entries(outputs)) byId(id).textContent = value;

    byId('scenario').textContent = `Modeled MAGI ${money.format(result.adjustedMagi)}. Without extra contributions, the deduction is ${money.format(result.baselineDeduction)}.`;
    const interestRelief = result.interestReliefPercent === null ? '' :
      ` Tax savings offset ${rate.format(result.interestReliefPercent)}% of interest paid.`;
    byId('breakdown').textContent = `Federal savings ${money.format(result.federalSavings)}. State savings ${money.format(result.stateSavings)}.${interestRelief}`;

    const reasons = result.disqualificationReasons.map((reason) => reasonLabels[reason]).join(' and ');
    const lossMessage = byId('loss-message');
    if (reasons) {
      lossMessage.textContent = `Ineligible due to ${reasons}. You lose ${money.format(result.disqualificationLoss)} of capped interest before the income test. The deduction and its tax savings are both $0.00.`;
    } else if (result.phaseoutLoss > 0) {
      lossMessage.textContent = `Your modeled MAGI costs you ${money.format(result.phaseoutLoss)} of the potential deduction.`;
    } else {
      lossMessage.textContent = 'Your modeled MAGI causes no phase-out loss.';
    }

    error.hidden = true;
    byId('results').hidden = false;
    lossMessage.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    error.textContent = failure.message;
    error.hidden = false;
    byId('results').hidden = true;
    byId('loss-message').hidden = true;
  }
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
