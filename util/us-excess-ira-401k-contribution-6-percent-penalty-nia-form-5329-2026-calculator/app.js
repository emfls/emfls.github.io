import { calculateExcess } from './model.mjs';

const form = document.querySelector('#calculator');
const error = document.querySelector('#input-error');
const results = document.querySelector('#results');
const status = document.querySelector('#estimate-status');
const fields = form.elements;
const accountInputs = {
  roth: { total: '8000', limit: '' },
  traditional: { total: '8000', limit: '' },
  '401k': { total: '26000', limit: '' },
};
let previousAccount = fields.account.value;
const byId = (id) => document.getElementById(id);
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (value) => value === null ? 'Awaiting plan earnings' : dollars.format(Math.abs(value) < 0.005 ? 0 : value);

function render() {
  const account = fields.account.value;
  const isPlan = account === '401k';
  const isRoth = account === 'roth';
  const usingOverride = fields.allowedLimit.value !== '';
  const visibility = {
    ira: !isPlan, plan: isPlan, roth: isRoth && !usingOverride,
  };
  for (const group of form.querySelectorAll('[data-fields]')) {
    group.hidden = !visibility[group.dataset.fields];
    group.disabled = group.hidden;
  }
  byId('total-label').textContent = isPlan
    ? 'Total 2026 employee deferrals ($)'
    : 'Total 2026 contributions to this IRA type ($)';
  byId('total-hint').textContent = isPlan
    ? 'Enter combined pre-tax and designated Roth employee deferrals across plans that share your limit. Exclude employer match.'
    : 'Combine your regular contributions to this IRA type. Use the allowed-limit field to account for contributions to the other IRA type.';

  const invalid = [...fields].find((field) => field.willValidate && !field.validity.valid);
  const number = (name) => fields[name].valueAsNumber;
  const optional = (name) => fields[name].value === '' ? null : number(name);
  try {
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent} ${invalid.validationMessage}`);
    const estimate = calculateExcess({
      account, age: number('age'), totalContributed: number('totalContributed'),
      allowedLimit: optional('allowedLimit'), filingStatus: fields.filingStatus.value,
      magi: number('magi'), marginalTaxRate: number('taxRate') / 100,
      openingBalanceBeforeContrib: number('openingBalanceBeforeContrib'),
      closingBalanceBeforeRemoval: number('closingBalanceBeforeRemoval'),
      periodContributions: optional('periodContributions'),
      otherContributionsInPeriod: number('otherContributionsInPeriod'),
      otherDistributionsInPeriod: number('otherDistributionsInPeriod'),
      yearEndValue: number('yearEndValue'),
      rothExcess: optional('rothExcess'), planEarnings: optional('planEarnings'),
    });
    for (const output of document.querySelectorAll('[data-result]')) {
      if (Object.hasOwn(estimate, output.dataset.result)) {
        output.textContent = money(estimate[output.dataset.result]);
      }
    }
    if (!isPlan) {
      for (const { years, penalty } of estimate.penaltyProjection) {
        byId(`penalty-${years}`).textContent = money(penalty);
      }
    }
    byId('ira-results').hidden = isPlan;
    byId('plan-results').hidden = !isPlan;
    byId('ira-decision').hidden = isPlan || !estimate.excessAmount;
    byId('plan-decision').hidden = !isPlan || !estimate.excessAmount;
    status.textContent = `Allowed limit ${money(estimate.allowedLimit)}. Excess ${money(estimate.excessAmount)}.`;
    error.textContent = '';
    error.hidden = true;
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.hidden = false;
    error.textContent = problem.message;
    status.textContent = '';
    results.hidden = true;
    byId('ira-decision').hidden = true;
    byId('plan-decision').hidden = true;
  }
}

form.addEventListener('input', (event) => {
  if (event.target === fields.account) {
    accountInputs[previousAccount] = {
      total: fields.totalContributed.value,
      limit: fields.allowedLimit.value,
    };
    previousAccount = fields.account.value;
    fields.totalContributed.value = accountInputs[previousAccount].total;
    fields.allowedLimit.value = accountInputs[previousAccount].limit;
  }
  render();
});
form.addEventListener('submit', (event) => event.preventDefault());
render();
