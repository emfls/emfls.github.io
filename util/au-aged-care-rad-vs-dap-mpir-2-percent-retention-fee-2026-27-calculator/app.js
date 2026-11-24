import { compareFunding, DEFAULTS } from './model.mjs';

const form = document.querySelector('#funding-form');
const error = document.querySelector('#input-error');
const results = document.querySelector('#funding-results');
const cards = document.querySelector('#strategy-cards');
const verdict = document.querySelector('#verdict');
const cpiSettings = document.querySelector('#cpi-settings');
const fields = form.elements;
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const integer = new Intl.NumberFormat('en-AU');
const strategyNames = { rad: '100% RAD', dap: '100% DAP', combo: 'Custom combination' };

function appendRow(list, label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  list.append(row);
}

function strategyCard(key, strategy, winner) {
  const card = document.createElement('article');
  card.className = 'strategy';
  card.toggleAttribute('data-winner', winner);

  const heading = document.createElement('h3');
  heading.textContent = strategyNames[key];

  const list = document.createElement('dl');
  const rows = [
    ['Net estate cost at end of stay', currency.format(strategy.netEstateCost)],
    ['Upfront RAD', currency.format(strategy.deposit)],
    ['Starting DAP per day', currency.format(strategy.dailyDap)],
    ['Starting DAP per 365 days', currency.format(strategy.annualDap)],
    ['DAP paid over stay', currency.format(strategy.dapPaid)],
    ['Total RAD retention', `${currency.format(strategy.retention)} (${strategy.retentionPercent.toFixed(2)}%)`],
    ['Estimated RAD refund to resident or estate', currency.format(strategy.refund)],
    ['Estimated Age Pension boost per year', currency.format(strategy.pensionAnnual)],
    ['Foregone after-tax growth on RAD', currency.format(strategy.forgoneReturn)],
  ];
  for (const [label, value] of rows) appendRow(list, label, value);
  card.append(heading, list);
  return card;
}

function readOptions() {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([name, fallback]) => {
    const field = fields.namedItem(name);
    if (typeof fallback === 'boolean') return [name, field.checked];
    if (typeof fallback === 'number') return [name, field.valueAsNumber];
    return [name, field.value];
  }));
}

function update() {
  const options = readOptions();
  const hasIndexation = !options.grandfathered && options.indexDap;
  fields.namedItem('indexDap').disabled = options.grandfathered;
  fields.namedItem('cpi').disabled = !hasIndexation;
  cpiSettings.hidden = !hasIndexation;

  let comparison;
  try {
    comparison = compareFunding(options);
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  const { winners, days } = comparison;
  const names = winners.map((key) => strategyNames[key]);
  const bestCost = currency.format(comparison[winners[0]].netEstateCost);
  const stay = `over ${integer.format(days)} days`;
  const outcome = names.length === 1
    ? `${names[0]} has the lowest projected estate cost, ${bestCost} ${stay}.`
    : `${names.join(' and ')} tie for the lowest projected estate cost, ${bestCost} ${stay}.`;
  if (verdict.textContent !== outcome) verdict.textContent = outcome;

  cards.replaceChildren(...Object.keys(strategyNames).map((key) =>
    strategyCard(key, comparison[key], winners.includes(key))));
  results.hidden = false;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', update);
update();
