import { calculateComparison } from './model.mjs';

const form = document.querySelector('#landlord-form');
const fields = [...form.querySelectorAll('input[type="number"]')];
const error = document.querySelector('#input-error');
const results = document.querySelector('#results');
const summary = document.querySelector('#comparison-summary');
const cashWarning = document.querySelector('#cash-warning');
const allowanceWarning = document.querySelector('#allowance-warning');
const cards = [...results.querySelectorAll('[data-scenario]')].map((card) => ({
  key: card.dataset.scenario,
  outputs: [...card.querySelectorAll('[data-result]')],
}));

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const gbp = (amount) => money.format(amount);

function describeCashRisk({ paperProfit, preTaxCash, personal2026, personal2027 }) {
  const figures = `Property profit before interest is ${gbp(paperProfit)} and cash flow before tax is ${gbp(preTaxCash)}.`;
  if (preTaxCash <= 0) {
    return `${figures} With no positive cash profit, a tax percentage would be misleading. Check the cash shortfall and the tax amounts above.`;
  }

  const worst = Math.max(personal2026.effectiveRate, personal2027.effectiveRate);
  if (worst > 1) {
    return `${figures} Extra Income Tax takes up to ${percent.format(worst)} of that cash profit and pushes at least one personal scenario into a loss.`;
  }
  if (worst === 1) {
    return `${figures} Extra Income Tax absorbs all of that cash profit in at least one personal scenario.`;
  }
  if (worst >= 0.6) {
    const remaining = Math.min(personal2026.afterTaxCash, personal2027.afterTaxCash);
    return `${figures} Extra Income Tax takes up to ${percent.format(worst)} of that cash profit, leaving as little as ${gbp(remaining)} before any principal repayment.`;
  }
  return `${figures} Extra Income Tax takes up to ${percent.format(worst)} of that cash profit under these inputs.`;
}

function describeAllowance({ adjustedNetIncome, allowance, allowanceLost, crossesTaper }) {
  const figures = `Adjusted net income is ${gbp(adjustedNetIncome)} and your Personal Allowance is ${gbp(allowance)}.`;
  if (crossesTaper) {
    return `Your rental pushes adjusted net income above the £100,000 taper threshold and costs you ${gbp(allowanceLost)} of Personal Allowance. ${figures}`;
  }
  if (allowanceLost > 0) {
    return `Your rental reduces your Personal Allowance by a further ${gbp(allowanceLost)} under the £100,000 taper. ${figures}`;
  }
  return `${figures} The £100,000 taper causes no additional allowance loss from the rental under these inputs.`;
}

function render() {
  const invalid = fields.filter((field) => !field.validity.valid);
  fields.forEach((field) => {
    if (invalid.includes(field)) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  });

  if (invalid.length) {
    const label = invalid[0].labels[0].textContent;
    error.textContent = `${label} needs a number from £0 to £1 billion with up to two decimal places.`;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const inputs = Object.fromEntries(fields.map(({ name, valueAsNumber }) => [name, valueAsNumber]));
  let model;
  try {
    model = calculateComparison(inputs);
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  for (const { key, outputs } of cards) {
    for (const output of outputs) {
      const metric = output.dataset.result;
      const value = model[key][metric];
      if (metric === 'effectiveRate') {
        output.textContent = value === null ? 'N/A' : percent.format(value);
      } else {
        output.textContent = gbp(value);
        if (metric === 'afterTaxCash') output.dataset.loss = String(value < 0);
      }
    }
  }

  const change = model.yearTaxChange;
  const changeText = change === 0
    ? 'No change in personal Income Tax in 2027/28.'
    : `The 2027/28 Budget scenario changes annual personal Income Tax by ${change > 0 ? '+' : '−'}${gbp(Math.abs(change))}.`;
  summary.textContent = `Pre-tax cash flow is ${gbp(model.preTaxCash)} a year. ${changeText}`;
  cashWarning.textContent = describeCashRisk(model);
  allowanceWarning.textContent = describeAllowance(model);
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
form.addEventListener('reset', () => queueMicrotask(render));
render();

// Manual responsive units require slot IDs belonging to the configured publisher.
for (const ad of document.querySelectorAll('.advert .adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
