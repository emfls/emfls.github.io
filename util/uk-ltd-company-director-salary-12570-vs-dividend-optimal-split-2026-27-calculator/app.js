import { compareStrategies, ELIGIBLE } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('remuneration');
const results = byId('results');
const strategies = byId('strategies');
const error = byId('form-error');
const winner = byId('winner');

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percentage = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 2 });
const titles = {
  A: '£12,570 salary + dividends',
  B: '£5,000 salary + dividends',
  C: 'All-salary PAYE'
};
const rows = [
  ['salary', 'Gross salary'],
  ['dividends', 'Gross dividends'],
  ['grossCash', 'Gross cash extracted'],
  ['corporationTax', 'Corporation Tax'],
  ['employerNI', 'Employer NI due'],
  ['employeeNI', 'Employee NI'],
  ['incomeTax', 'Salary Income Tax'],
  ['dividendTax', 'Dividend tax'],
  ['personalTax', 'Total personal Income Tax'],
  ['netCash', 'Net cash in pocket'],
  ['retainedProfit', 'Post-tax company profit retained'],
  ['combinedTaxRate', 'Effective combined tax rate']
];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function readAmount(id, fallback) {
  const input = byId(id);
  if (input.validity.badInput || (!input.value && fallback === undefined)) {
    throw new RangeError(`Enter a valid amount for ${input.labels[0].textContent}.`);
  }
  return input.value === '' ? fallback : input.valueAsNumber;
}

function renderStrategy(strategy, isWinner, hasTarget) {
  const card = element('article', '', 'strategy');
  card.id = `strategy-${strategy.id}`;
  card.dataset.winner = isWinner;
  card.append(element('h3', `${strategy.id} · ${titles[strategy.id]}`));
  const list = element('dl');
  const metrics = hasTarget ? [...rows, ['targetShortfall', 'Gross target shortfall']] : rows;
  for (const [key, label] of metrics) {
    const row = element('div', '', key === 'netCash' ? 'net' : '');
    const value = key === 'combinedTaxRate'
      ? (strategy[key] === null ? 'N/A' : percentage.format(strategy[key]))
      : money.format(strategy[key]);
    row.append(element('dt', label), element('dd', value));
    list.append(row);
  }
  card.append(list);
  if (strategy.belowLowerEarningsLimit) {
    card.append(element('p', 'Salary below the £6,708 Lower Earnings Limit.', 'note'));
  }
  return card;
}

function update() {
  const hasTarget = byId('extraction').value === 'target';
  const eligibility = byId('eligibility').value;
  const hasAllowance = eligibility === ELIGIBLE;
  byId('target-field').hidden = !hasTarget;
  byId('target').disabled = !hasTarget;
  byId('allowance-field').hidden = !hasAllowance;
  byId('allowance').disabled = !hasAllowance;

  let comparison;
  try {
    comparison = compareStrategies({
      profit: readAmount('profit'),
      pension: readAmount('pension', 0),
      target: hasTarget ? readAmount('target') : null,
      employmentAllowanceEligibility: eligibility,
      remainingAllowance: hasAllowance ? readAmount('allowance') : 0
    });
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.hidden = false;
    error.textContent = exception.message;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  const { winners, targetMet, cashGain } = comparison;
  const names = winners.map(({ id }) => id).join(', ');
  const takeHome = money.format(winners[0].netCash);
  const summary = [winners.length > 1
    ? `Strategies ${names} tie at ${takeHome} take-home.`
    : `Strategy ${names} has the highest take-home at ${takeHome}.`];
  if (!targetMet) summary.unshift('None of the strategies can fully fund your gross cash target.');
  if (cashGain > 0) {
    summary.push(`${money.format(cashGain)} more take-home than the next best strategy${hasTarget && targetMet ? ' that meets the target' : ''}.`);
  } else if (cashGain === null) {
    summary.push('This is the only strategy that meets your gross cash target.');
  }

  results.hidden = false;
  winner.textContent = summary.join(' ');
  const winnerIds = new Set(winners.map(({ id }) => id));
  strategies.replaceChildren(...comparison.strategies.map(
    strategy => renderStrategy(strategy, winnerIds.has(strategy.id), hasTarget)
  ));
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
update();
