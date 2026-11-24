import { calculate, POLICY } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('calculator');
const error = get('error');
const results = get('results');
const credit = get('bc-credit');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 });
const statusLabels = {
  'below-six': 'Below the six-month threshold',
  both: 'Meets both modeled tenancy tests',
  'city-only': 'Meets the City tenancy test only',
  'bc-only': 'Meets the B.C. tenancy test only',
  neither: 'Qualifying rental periods required',
};

function numericValue(id) {
  const value = get(id).value;
  return value.trim() === '' ? NaN : Number(value);
}

function update() {
  const ownerStatus = get('owner-status').value;
  const monthsRented = numericValue('months-rented');
  credit.disabled = ownerStatus !== 'canadian_pr';

  try {
    const estimate = calculate({
      assessedValue: numericValue('assessed-value'),
      ownerStatus,
      monthsRented,
      monthlyRent: numericValue('monthly-rent'),
      marginalRate: numericValue('marginal-rate'),
      afterTaxRentalCosts: numericValue('rental-costs'),
      cityTenancy: get('city-tenancy').checked,
      bcTenancy: get('bc-tenancy').checked,
      cityDeclared: get('city-declared').checked,
      bcCredit: credit.checked,
    });

    for (const [id, amount] of Object.entries({
      'annual-tax': estimate.annualTax,
      'cash-swing': estimate.cashSwing,
      'vacant-tax': estimate.vacantTax,
      eht: estimate.eht,
      svt: estimate.svt,
      'credit-applied': estimate.creditApplied,
      'city-notice': estimate.cityNotice,
      'five-year': estimate.fiveYearCost,
      'vacant-five-year': estimate.vacantFiveYearCost,
      'tax-avoided': estimate.taxAvoided,
      'net-rent': estimate.netRentalIncome,
    })) get(id).textContent = money.format(amount);

    get('svt-rate').textContent = percent.format(estimate.svtRate * 100) + '%';
    get('effective-rate').textContent = percent.format(estimate.effectiveRate) + '%';
    get('tenancy-status').textContent = statusLabels[estimate.tenancyStatus];
    get('tenancy-status').dataset.status = estimate.tenancyStatus;
    get('filing-warning').hidden = estimate.cityNotice === 0;
    get('break-even').textContent = estimate.breakEvenRent === null
      ? 'No applicable rent'
      : money.format(estimate.breakEvenRent);
    get('threshold-note').hidden = monthsRented >= POLICY.thresholdMonths;
    error.hidden = true;
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    error.hidden = false;
    results.hidden = true;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
