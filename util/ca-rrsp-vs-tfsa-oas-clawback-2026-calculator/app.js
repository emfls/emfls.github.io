import { compareAccounts } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('calculator');
const error = get('error');
const details = get('result-details');
const scenarios = get('scenarios');
const template = get('scenario-template');
const headline = get('headline');
const matchedBudget = get('matched-budget');
const oasContext = get('oas-context');
const refundImpact = get('refund-impact');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const budgetType = get('budgetType');
const preset = get('oasPreset');
const annualOas = get('annualOas');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percentage = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const money = (value) => currency.format(value);
const percent = (value) => percentage.format(value);
const headings = {
  reinvested: 'RRSP · Refund reinvested',
  spent: 'RRSP · Refund spent',
  tfsa: 'TFSA',
};

function makeCard(key, projection, winner) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector('h3').textContent = headings[key];
  card.dataset.winner = String((key === 'reinvested' && winner === 'rrsp') || key === winner);
  for (const field of card.querySelectorAll('[data-value]')) {
    const name = field.dataset.value;
    field.textContent = name.endsWith('Rate') ? percent(projection[name]) : money(projection[name]);
  }
  return card;
}

function showResults(result, currentRate) {
  const { winner, margin, investedCash, uninvestedCash, reinvested, spent, baselineRecovery } = result;
  const headlines = {
    rrsp: `RRSP with refund reinvested leads by ${money(margin)}`,
    tfsa: `TFSA leads by ${money(margin)}`,
    tie: 'RRSP with refund reinvested and TFSA tie',
    none: 'No matched contribution to compare',
  };
  headline.textContent = headlines[winner];
  const room = `Available room is ${money(result.availableRrspRoom)} RRSP and ${money(result.availableTfsaRoom)} TFSA.`;
  const reduced = uninvestedCash >= 0.005
    ? ` Contribution room leaves ${money(uninvestedCash)} of the after-tax budget outside this comparison.`
    : '';
  matchedBudget.textContent = `${money(investedCash)} matched after-tax cash. ${room}${reduced}`;
  scenarios.replaceChildren(...Object.keys(headings).map((key) => makeCard(key, result[key], winner)));

  const cutoff = result.fullRecoveryIncome === null
    ? 'No OAS benefit is assumed.'
    : `With this benefit amount, OAS is fully recovered at ${money(result.fullRecoveryIncome)} of annual net world income.`;
  const rates = reinvested.gross > 0
    ? `Working rate ${percent(currentRate)} vs. effective RRSP withdrawal rate ${percent(reinvested.effectiveRate)}. `
    : '';
  oasContext.textContent = `${rates}Baseline OAS recovery before withdrawals is ${money(baselineRecovery)} per year. ${cutoff}`;
  refundImpact.textContent = `Spending the ${money(spent.refund)} refund today leaves ${money(result.refundCost)} less in this retirement scenario after tax and OAS recovery.`;
  details.hidden = false;
}

function update() {
  for (const input of inputs) {
    if (input.validity.valid) {
      input.removeAttribute('aria-invalid');
    } else {
      input.setAttribute('aria-invalid', 'true');
    }
  }
  try {
    const invalid = inputs.find((input) => !input.validity.valid);
    if (invalid) {
      throw new RangeError(`${invalid.labels[0].textContent}: ${invalid.validationMessage}`);
    }
    const options = Object.fromEntries(inputs.map((input) => [input.name, input.valueAsNumber]));
    for (const key of ['annualReturn', 'currentRate', 'retirementRate']) {
      options[key] /= 100;
    }
    options.budgetType = budgetType.value;
    options.recoveryTaxTreatment = get('recoveryTaxTreatment').value;
    showResults(compareAccounts(options), options.currentRate);
    error.hidden = true;
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    headline.textContent = 'Update your inputs to see the comparison';
    matchedBudget.textContent = '';
    details.hidden = true;
  }
}

form.addEventListener('input', ({ target }) => {
  if (target === budgetType) {
    get('budget-help').textContent = budgetType.value === 'preTax'
      ? 'Gross income available before applying your working tax rate.'
      : 'Cash available after income tax.';
  } else if (target === preset && preset.value !== 'custom') {
    annualOas.value = preset.value;
  } else if (target === annualOas) {
    preset.value = 'custom';
  }
  update();
});
form.addEventListener('submit', (event) => event.preventDefault());
update();
