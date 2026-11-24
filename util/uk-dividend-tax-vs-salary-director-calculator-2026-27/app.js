import { compareStrategies } from './model.mjs';

const form = document.getElementById('director-form');
const profitInput = document.getElementById('profit');
const pensionInput = document.getElementById('pension');
const eligibleInput = document.getElementById('eligible');
const remainingInput = document.getElementById('remaining');
const remainingField = document.getElementById('remaining-field');
const error = document.getElementById('input-error');
const comparison = document.getElementById('comparison');
const winner = document.getElementById('winner');
const savings = document.getElementById('savings');
const pensionImpact = document.getElementById('pension-impact');
const strategies = document.getElementById('strategies');
const salaryLimit = document.getElementById('salary-limit');

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = pence => pounds.format(pence / 100);
const titles = {
  'personal-allowance': '£12,570 salary + dividends',
  'secondary-threshold': '£5,000 salary + dividends',
  paye: 'All-PAYE salary',
};

const fields = [
  ['Gross salary', 'salary'],
  ['Gross dividends', 'dividends'],
  ['Employer NI before allowance', 'grossEmployerNI'],
  ['Employment Allowance used', 'employmentAllowanceUsed'],
  ['Employer NI due', 'employerNI'],
  ['Company taxable profit', 'companyTaxableProfit'],
  ['Corporation Tax', 'corporationTax'],
  ['Profit retained', 'retainedProfit'],
  ['Personal Allowance', 'personalAllowance'],
  ['Income Tax on salary', 'salaryTax'],
  ['Dividend tax', 'dividendTax'],
  ['Employee NI', 'employeeNI'],
  ['Paid to pension', 'pension'],
];

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function strategyCard(row, isBest) {
  const card = element('article', undefined, 'strategy');
  card.dataset.best = String(isBest);
  const title = element('h3', titles[row.id]);
  const cash = element('p', 'Annual cash take-home', 'cash');
  cash.append(element('strong', money(row.takeHome)));
  const details = element('dl');
  for (const [label, key] of fields) {
    if (key === 'retainedProfit' && row[key] === 0) continue;
    const item = element('div');
    item.append(element('dt', label), element('dd', money(row[key])));
    details.append(item);
  }
  const niStatus = row.meetsLEL
    ? 'Salary meets the annual NI earnings threshold.'
    : 'Salary falls below the annual NI earnings threshold.';
  card.append(title, cash, details, element('p', niStatus, 'note'));
  return card;
}

function cashDifference(amount, higher, lower, equal) {
  if (amount > 0) return higher(money(amount));
  if (amount < 0) return lower(money(-amount));
  return equal;
}

function calculate() {
  remainingField.hidden = !eligibleInput.checked;
  remainingInput.disabled = !eligibleInput.checked;
  const inputs = [profitInput, pensionInput, remainingInput];
  for (const input of inputs) input.removeAttribute('aria-invalid');

  try {
    const [profit, pension, allowance] = inputs.map(input => {
      if (input.disabled) return 0;
      if (!input.validity.valid) {
        input.setAttribute('aria-invalid', 'true');
        const label = input.labels[0].textContent.replace(/\s*\(£\)$/, '');
        throw new RangeError(`${label}: enter an amount from £0 to ${pounds.format(Number(input.max))} with up to two decimal places.`);
      }
      return Math.round(input.valueAsNumber * 100);
    });

    if (pension > profit) {
      pensionInput.setAttribute('aria-invalid', 'true');
      throw new RangeError('The company pension contribution must fit within company profit.');
    }

    const result = compareStrategies({ profit, pension, allowance });
    const top = Math.max(...result.strategies.map(row => row.takeHome));
    const topNames = result.winners.map(id => titles[id]).join(' / ');
    winner.textContent = result.winners.length === 1
      ? `${topNames} leads at ${money(top)}`
      : `Highest cash take-home tied at ${money(top)}`;
    savings.textContent = cashDifference(
      result.savingsVsPaye,
      amount => `The better salary-and-dividend option leaves ${amount} more cash than all-PAYE.`,
      amount => `All-PAYE leaves ${amount} more cash than the better salary-and-dividend option.`,
      'The better salary-and-dividend option and all-PAYE leave the same cash take-home.',
    );

    pensionImpact.hidden = pension === 0;
    if (pension > 0) {
      const withoutPension = compareStrategies({ profit, allowance });
      const baseline = Math.max(...withoutPension.strategies.map(row => row.takeHome));
      const cashImpact = cashDifference(
        top - baseline,
        amount => `The highest cash take-home is ${amount} higher than with a £0 contribution.`,
        amount => `The highest cash take-home is ${amount} lower than with a £0 contribution.`,
        'The highest cash take-home is the same as with a £0 contribution.',
      );
      pensionImpact.textContent = `${money(pension)} goes into the pension under each strategy. ${cashImpact}`;
    }

    strategies.replaceChildren(...result.strategies.map(row => strategyCard(row, result.winners.includes(row.id))));
    salaryLimit.hidden = !result.strategies.some(row => row.salary < row.target);
    error.textContent = '';
    comparison.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    comparison.hidden = true;
  }
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});
calculate();

document.querySelectorAll('.ad-space .adsbygoogle[data-ad-slot]').forEach(() => {
  (window.adsbygoogle = window.adsbygoogle || []).push({});
});
