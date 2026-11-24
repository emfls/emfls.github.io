import { checkQuickMethod, checkSmallSupplier, compareMethods } from './model.mjs';

const byId = id => document.getElementById(id);
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const money = value => cad.format(Math.abs(value) < 0.005 ? 0 : value);
const set = (id, value) => { byId(id).textContent = value; };

function readNumber(id) {
  const input = byId(id);
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) {
    throw new RangeError('Check ' + input.labels[0].textContent.toLowerCase()
      + '. Enter a number within the allowed range, with up to two decimal places.');
  }
  return input.valueAsNumber;
}

const eligibilityMessages = {
  passes: 'Quick Method passes the sales test and the other qualifications are marked met.',
  excluded: 'Quick Method is unavailable for the selected business or institution. The comparison is hypothetical.',
  'over-limit': 'The entered sales exceed the $400,000 eligibility cap. The comparison is hypothetical.',
  unconfirmed: 'Other Quick Method qualifications are unconfirmed or unmet. The comparison is hypothetical.',
};

function renderComparison() {
  const results = byId('comparison-results');
  const error = byId('comparison-error');

  try {
    const eligibility = checkQuickMethod(readNumber('test-sales'), byId('qualifications').value);
    const operatingITCs = readNumber('operating-itcs');
    const capitalITCs = readNumber('capital-itcs');
    const result = compareMethods({
      region: byId('region').value,
      businessType: byId('business-type').value,
      sales: readNumber('sales'),
      eligibleExpenses: readNumber('eligible-expenses'),
      otherExpenses: readNumber('other-expenses'),
      operatingITCs,
      capitalITCs,
      incomeTaxRate: readNumber('income-tax') / 100,
      qualifiesForCredit: byId('credit').checked,
    });

    const difference = money(Math.abs(result.afterTaxSavings));
    const warnings = {
      quick: 'Keep ' + difference + ' more after income tax in this scenario with Quick Method. Recheck the comparison if your operating ITCs rise.',
      regular: 'Choosing Quick Method in this scenario would leave ' + difference + ' less cash after income tax. Check your operating ITCs before electing.',
      tie: 'The two methods tie to the nearest cent in this scenario. A change in operating ITCs could shift the result.',
    };
    const winners = {
      quick: 'Quick by ' + difference,
      regular: 'Regular by ' + difference,
      tie: 'Tie',
    };
    const { breakEvenExpenseRatio, currentExpenseRatio, operatingITCRate } = result;
    const ratioNote = currentExpenseRatio === null
      ? 'A break-even expense ratio requires positive sales.'
      : breakEvenExpenseRatio === null
        ? 'At a 0% effective operating ITC rate, increasing these expenses cannot create a Regular Method advantage.'
        : 'Current expense ratio ' + percent.format(currentExpenseRatio)
          + ' · Effective operating ITC rate ' + percent.format(operatingITCRate)
          + '. Regular wins above break-even at the same ITC rate.';

    set('eligibility-status', eligibilityMessages[eligibility]);
    set('cash-warning', warnings[result.winner]);
    set('pre-tax', money(result.preTaxSavings));
    set('after-tax', winners[result.winner] + (eligibility === 'passes' ? '' : ' (hypothetical)'));
    set('break-even', breakEvenExpenseRatio === null ? 'N/A' : percent.format(breakEvenExpenseRatio));
    set('break-even-note', ratioNote);
    set('sales-summary', 'Tax-included sales ' + money(result.grossTaxIncludedSales)
      + ' · GST/HST collected ' + money(result.taxCollected)
      + ' · Quick Method rate ' + percent.format(result.quickRate));
    set('regular-remit', money(result.regularRemittance));
    set('quick-remit', money(result.quickRemittance));
    set('regular-itcs', money(operatingITCs));
    set('regular-capital', money(capitalITCs));
    set('quick-capital', money(capitalITCs));
    set('quick-credit', money(result.credit1Pct));
    set('regular-profit', money(result.regularAfterTaxProfit));
    set('quick-profit', money(result.quickAfterTaxProfit));
    set('income-effect', 'Quick Method adds ' + money(result.retainedTaxIncome)
      + ' in retained GST/HST and credit before deducting unrecovered operating tax. Income tax change vs Regular Method '
      + money(result.extraIncomeTax) + '.');
    error.hidden = true;
    results.hidden = false;
  } catch (problem) {
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

const thresholdMessages = {
  'within-limit': 'The entered window is at or below $30,000. The general small-supplier test does not require registration on these figures. Voluntary registration may be available.',
  'single-quarter': 'A single quarter exceeds $30,000. If this is when you first lost small-supplier status, start charging on the sale that crossed the limit and register within 29 days of the effective registration date.',
  'rolling-quarters': 'The four-quarter total exceeds $30,000. If this is your first breach, small-supplier status ends at the end of the month after the crossing quarter. Start charging on the effective registration date, no later than your first taxable sale after you lose that status. Register within 29 days of the effective date.',
};

function renderThreshold() {
  try {
    const quarters = [1, 2, 3, 4].map(number => readNumber('quarter-' + number));
    const result = checkSmallSupplier(quarters);
    set('threshold-result', 'Four-quarter total ' + money(result.total)
      + ' · Highest quarter ' + money(result.highestQuarter) + '\n' + thresholdMessages[result.status]);
  } catch (problem) {
    set('threshold-result', problem.message);
  }
}

for (const [id, render] of [['comparison', renderComparison], ['threshold', renderThreshold]]) {
  const form = byId(id);
  form.addEventListener('input', render);
  form.addEventListener('submit', event => event.preventDefault());
  render();
}
