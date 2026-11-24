import { compareStrategies, LIMITS_2026 } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const rule = byId('roth-rule');
const comparison = byId('comparison');
const error = byId('input-error');
const loss = byId('loss-message');
const defaultLossMessage = loss.textContent;
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const money = (value) => dollars.format(value);
const strategyLabels = {
  traditional: 'Traditional-first',
  roth: '100% Roth employee deferrals',
  optimal: 'Optimal split',
};

function readInputs() {
  const inputs = {};
  for (const field of form.querySelectorAll('input[type="number"]')) {
    if (!field.validity.valid) {
      const label = field.labels[0].textContent;
      throw new RangeError(`${label} — ${field.validationMessage}`);
    }
    inputs[field.id] = field.valueAsNumber / (field.hasAttribute('data-percent') ? 100 : 1);
  }
  inputs.rothMatch = byId('rothMatch').checked;
  inputs.reinvestSavings = byId('reinvestSavings').value === 'invest';
  return inputs;
}

function strategyCard(name, strategy, reinvestSavings) {
  const card = document.createElement('article');
  card.className = 'strategy';
  const title = document.createElement('h3');
  title.textContent = strategyLabels[name];
  const total = document.createElement('strong');
  total.className = 'wealth';
  total.textContent = money(strategy.afterTaxWealth);
  const breakdown = document.createElement('dl');
  for (const [label, value] of [
    ['Annual pre-tax employee deferral', strategy.preTaxEmployee],
    ['Annual Roth employee deferral', strategy.rothEmployee],
    ['Annual deferral cost after current taxes', strategy.paycheckCost],
    ['Annual income tax savings', strategy.taxSavings],
    [reinvestSavings ? 'Annual brokerage deposit' : 'Annual savings spent',
      reinvestSavings ? strategy.brokerageDeposit : strategy.spentSavings],
    ['After-tax brokerage at retirement', strategy.afterTaxBrokerage],
  ]) {
    const term = document.createElement('dt');
    term.textContent = label;
    const amount = document.createElement('dd');
    amount.textContent = money(value);
    breakdown.append(term, amount);
  }
  card.append(title, total, breakdown);
  return card;
}

function render() {
  let inputs;
  try {
    inputs = readInputs();
  } catch (invalid) {
    error.textContent = invalid.message;
    rule.hidden = true;
    comparison.hidden = true;
    loss.textContent = defaultLossMessage;
    return;
  }

  const result = compareStrategies(inputs);
  error.textContent = '';
  rule.hidden = !result.limits.mandatoryRoth;
  byId('rule-message').textContent = result.mandatoryRothDeferral > 0
    ? `${money(result.mandatoryRothDeferral)} of your annual deferral is catch-up and goes to Roth in every strategy. Your regular deferral can still be pre-tax.`
    : `Your 2025 sponsor FICA wages exceed ${money(LIMITS_2026.priorYearFicaThreshold)}. Any catch-up deferral you make must go to Roth. Your current entry uses no catch-up.`;

  const leadingStrategy = result.preferred === 'roth' ? 'The 100% Roth strategy' : 'Traditional-first';
  byId('ranking').textContent = result.preferred === 'tie'
    ? 'Traditional-first and all-Roth produce the same projected after-tax wealth.'
    : `${leadingStrategy} produces more projected after-tax wealth under these assumptions.`;
  const matchType = inputs.rothMatch ? 'Roth' : 'pre-tax';
  const matchTax = result.matchTax > 0 ? ` Annual tax on the Roth match is ${money(result.matchTax)}.` : '';
  byId('budget').textContent = `Annual cash budget ${money(result.cashBudget)}. Annual ${matchType} employer match ${money(result.employerMatch)}.${matchTax}`;
  byId('break-even').textContent = result.breakEvenTaxRate === null
    ? 'Break-even retirement tax rate is unavailable because there are no optional pre-tax deferrals.'
    : `Break-even retirement tax rate: ${percent.format(result.breakEvenTaxRate)}.`;
  const capped = inputs.annualDeferral > result.employeeDeferral ? ' Your planned deferral was capped by pay or the IRS limit.' : '';
  byId('applied-limits').textContent = `Annual employee deferral ${money(result.employeeDeferral)}, including ${money(result.catchUpDeferral)} catch-up. Annual additions limit before catch-up ${money(result.annualAdditionsLimit)}.${capped}`;
  byId('strategies').replaceChildren(
    ...Object.keys(strategyLabels).map((name) => strategyCard(name, result[name], inputs.reinvestSavings)),
  );
  byId('qualification').hidden = inputs.age + inputs.yearsToRetirement >= 60 && inputs.yearsToRetirement >= 5;

  const invested = inputs.reinvestSavings ? result : compareStrategies({ ...inputs, reinvestSavings: true });
  loss.textContent = invested.traditional.afterTaxBrokerage > 0
    ? `Spending the ${money(invested.traditional.taxSavings)} annual tax savings in the Traditional-first strategy would leave you with ${money(invested.traditional.afterTaxBrokerage)} less after tax at retirement under these assumptions.`
    : defaultLossMessage;
  comparison.hidden = false;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();

for (const slot of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (slot.dataset.adSlot) {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
}
