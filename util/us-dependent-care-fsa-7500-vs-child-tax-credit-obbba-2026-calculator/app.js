import { optimizeCare } from './model.mjs';

const find = id => document.getElementById(id);
const form = find('care-form');
const results = find('results');
const error = find('error');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const integer = new Intl.NumberFormat('en-US');
const strategies = {
  max: 'Max DC-FSA',
  credit: '100% Child and Dependent Care Credit',
  hybrid: 'Hybrid split',
  partial: 'Partial DC-FSA'
};
const numericFields = [...form.querySelectorAll('input[type="number"]')];

function write(id, value) {
  find(id).textContent = value;
}

function update() {
  const status = find('status').value;
  const mfsLivingApart = status === 'mfs' && find('mfsLivingApart').checked;
  const spouse = find('spouseWages');
  find('mfs-field').hidden = status !== 'mfs';
  spouse.disabled = status !== 'mfj' && (status !== 'mfs' || mfsLivingApart);
  find('spouse-field').hidden = spouse.disabled;

  try {
    const numbers = {};
    for (const input of numericFields) {
      if (input.disabled) continue;
      if (!input.validity.valid) {
        const label = input.labels[0].textContent.trim();
        throw new RangeError(`Check ${label}. ${input.validationMessage}`);
      }
      numbers[input.name] = input.valueAsNumber;
    }

    const { best, creditOnly, maxFsa, gainOverCreditOnly, gainOverMaxFsa, allocationsTested } = optimizeCare({
      ...numbers, status, mfsLivingApart, actcEligible: find('actcEligible').checked
    });

    const noCareSavings = best.careSavings === 0 && best.fsa === 0;
    write('strategy', noCareSavings ? 'No modeled care savings' :
      best.strategy === 'max' ? `Max ${wholeDollars.format(best.fsa)} DC-FSA` : strategies[best.strategy]);
    write('family-relief', currency.format(best.familyRelief));
    write('election', wholeDollars.format(best.fsa));
    write('fsa-savings', currency.format(best.fsaSavings));
    write('credit-base', currency.format(best.creditBase));
    write('care-credit', best.creditBase > 0
      ? `${currency.format(best.careCredit)} (${best.careRate}% rate)`
      : currency.format(best.careCredit));
    write('ctc', currency.format(best.ctc));
    write('actc', currency.format(best.actc));
    write('credit-only-total', currency.format(creditOnly.familyRelief));
    write('credit-only-gap', currency.format(gainOverCreditOnly));
    write('max-fsa-label', maxFsa.fsa ? `Max DC-FSA (${wholeDollars.format(maxFsa.fsa)})` : 'No FSA available');
    write('max-fsa-total', currency.format(maxFsa.familyRelief));
    write('max-fsa-gap', currency.format(gainOverMaxFsa));

    const gap = Math.max(gainOverCreditOnly, gainOverMaxFsa);
    write('largest-gap', gap > 0
      ? `The best election saves ${currency.format(gap)} more than the lower-saving choice shown above.`
      : 'The choices shown yield the same modeled total.');
    const tested = integer.format(allocationsTested);
    write('search-note', `Compared ${tested} whole-dollar ${allocationsTested === 1 ? 'election' : 'elections'}. Equal savings favor the smaller election.`);

    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
