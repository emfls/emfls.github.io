import { calculateEss, financialYear } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('ess-form');
const error = get('result-error');
const results = get('results');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const dateFormat = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' });
const moneyFields = [
  'netProceeds', 'grossProceeds', 'employeeCost', 'assessableEssDiscount',
  'upfrontReduction', 'essTax', 'cgtCostBase', 'rawCapitalGain',
  'taxableCapitalGain', 'cgtTax', 'crashProtectionSaved', 'discountSavings',
];

function formatDate(value) {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

function render() {
  const scheme = get('scheme').value;
  const deferred = scheme === 'deferred';
  const startup = scheme === 'startup';
  const readNumber = (id) => get(id).valueAsNumber;
  const taxingPointDate = get('taxingPointDate').value;
  const grantDate = get('grantDate').value;
  const saleDate = get('saleDate').value;
  const originalDate = deferred ? taxingPointDate : grantDate;

  get('market-field').hidden = startup;
  get('taxing-date-field').hidden = !deferred;
  get('grant-date-field').hidden = deferred;
  get('ess-income-field').hidden = startup;
  get('sale-income-field').hidden = !startup && (!originalDate || !saleDate);
  get('ati-field').hidden = scheme !== 'upfront';
  get('reduction-row').hidden = scheme !== 'upfront';
  get('market-label').textContent = deferred
    ? 'Market value per share at taxing point'
    : 'Market value per share at grant';
  get('cgt-label').textContent = deferred ? 'Tax on post-vesting gain' : 'Tax on capital gain';

  try {
    const originalYear = originalDate ? financialYear(originalDate) : '';
    const saleYear = saleDate ? financialYear(saleDate) : '';
    get('sale-income-field').hidden = !startup && (!originalYear || !saleYear || originalYear === saleYear);
    get('ess-income-label').textContent = originalYear
      ? `Other taxable income in ${originalYear}`
      : 'Other taxable income in original ESS year';
    get('sale-income-label').textContent = saleYear
      ? `Other taxable income in ${saleYear} (disposal year)`
      : 'Other taxable income in disposal year';

    const marketValue = readNumber('marketValue');
    const estimate = calculateEss({
      scheme, taxingPointDate, grantDate, saleDate,
      shares: readNumber('shares'),
      amountPaid: readNumber('amountPaid'),
      salePrice: readNumber('salePrice'),
      fmvAtTaxingPoint: marketValue,
      fmvAtGrant: marketValue,
      otherEssIncome: readNumber('otherEssIncome'),
      otherSaleIncome: readNumber('otherSaleIncome'),
      adjustedTaxableIncome: readNumber('adjustedTaxableIncome'),
    });

    for (const field of moneyFields) {
      get(field).textContent = estimate[field] === null ? 'N/A' : currency.format(estimate[field]);
    }
    get('benchmark').hidden = !estimate.usesBenchmark;
    if (estimate.soldWithin30Days) {
      get('timing').textContent = `The 30-day rule moves ESS taxation to ${formatDate(estimate.essTaxDate)} (${estimate.essTaxYear}). No separate gain or loss applies.`;
    } else if (startup) {
      get('timing').textContent = `The start-up concession gives you zero assessable ESS discount. Disposal year ${estimate.saleYear}.`;
    } else {
      get('timing').textContent = `ESS taxing point ${formatDate(estimate.essTaxDate)} (${estimate.essTaxYear}). Disposal year ${estimate.saleYear}.`;
    }

    const waiting = get('waiting');
    waiting.hidden = estimate.earliestDiscountDate === null;
    if (!waiting.hidden) {
      const firstDay = formatDate(estimate.earliestDiscountDate);
      if (saleDate >= '2027-07-01' || estimate.earliestDiscountDate >= '2027-07-01') {
        waiting.textContent = `The 12-month holding condition is first met on ${firstDay}. The waiting benefit is unavailable where the sale or qualifying date falls under the CGT transition from 1 July 2027.`;
      } else if (estimate.discountEligible) {
        waiting.textContent = `The 12-month holding condition is met. First qualifying disposal date: ${firstDay}.`;
      } else {
        waiting.textContent = `First qualifying disposal date: ${firstDay}. Any waiting benefit shown holds price, other income and the sale-year tax calculation constant.`;
      }
    }
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
