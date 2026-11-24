import { calculateSection677, presetMarginalRate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const error = byId('input-error');
const results = byId('results');
const rate = byId('marginal-rate');
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 3 });
const money = value => cad.format(Math.abs(value) < 0.005 ? 0 : value);

function update() {
  try {
    const incomeTier = byId('tier').value;
    rate.readOnly = incomeTier !== 'custom';
    if (rate.readOnly) {
      rate.value = Number((presetMarginalRate(byId('province').value, Number(incomeTier)) * 100).toFixed(3));
    }

    const invalid = Array.from(form.elements).find(field => !field.validity.valid);
    if (invalid) {
      const label = invalid.labels[0].textContent;
      throw new RangeError(label + '. ' + invalid.validationMessage);
    }
    const value = id => byId(id).valueAsNumber;
    const result = calculateSection677({
      grossRevenue: value('revenue'),
      mortgageInterest: value('interest'),
      propertyCosts: value('property-costs'),
      operatingCosts: value('operating-costs'),
      cca: value('cca'),
      strDays: value('str-days'),
      nonCompliantDays: value('non-compliant-days'),
      marginalRate: rate.valueAsNumber / 100,
      monthlyRent: value('monthly-rent'),
      leaseExpenses: value('lease-expenses'),
    });

    for (const output of results.querySelectorAll('[data-money]')) {
      output.textContent = money(result[output.dataset.money]);
    }
    byId('share').textContent = percent.format(result.nonCompliantShare);
    const effectiveRate = result.effectiveTaxRateOnTrueCashFlow;
    byId('effective-rate').textContent = Number.isFinite(effectiveRate)
      ? percent.format(effectiveRate / 100)
      : 'N/A · cash flow is zero or negative';
    byId('break-even').textContent = Number.isFinite(result.breakEvenMonthlyRent)
      ? money(result.breakEvenMonthlyRent) + ' per month'
      : 'Unreachable at a 100% marginal rate';

    const warning = byId('cash-warning');
    warning.hidden = result.nonCompliantTax <= result.preTaxCashFlow || result.nonCompliantTax <= 0;
    warning.textContent = result.preTaxCashFlow > 0
      ? 'Estimated tax exceeds 100% of pre-tax cash flow. This scenario leaves an after-tax cash loss.'
      : 'Estimated tax is due even though the short-term rental has zero or negative pre-tax cash flow.';
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
