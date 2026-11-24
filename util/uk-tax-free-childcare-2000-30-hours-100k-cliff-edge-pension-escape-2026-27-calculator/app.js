import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const childList = byId('children');
const addChildButton = byId('add-child');
const estimate = byId('estimate');
const error = byId('error');
const sterling = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const hours = new Intl.NumberFormat('en-GB');
const fmt = amount => sterling.format(amount);
const difference = (value, base) => {
  const change = Math.round((value - base) * 100) / 100;
  return change > 0 ? '+' + fmt(change) : fmt(change);
};

function scenarioCard(title, scenario, baseline, hasPartner, mode) {
  const card = document.createElement('article');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('dl');
  const delta = mode === 'cash' ? '' : ' (' + difference(scenario.cash, baseline.cash) + ')';
  const wealthDelta = mode === 'cash' ? '' : ' (' + difference(scenario.cashPlusPension, baseline.cash) + ')';
  const entries = [
    ['Cash after childcare', fmt(scenario.cash) + delta],
    ['Gross pension added', fmt(scenario.pension)],
    ['Cash plus pension', fmt(scenario.cashPlusPension) + wealthDelta],
    ['Childcare income test', scenario.passesIncomeTest ? 'Passes' : 'Above the limit'],
    ['Funded hours and bill savings', hours.format(scenario.care.hours) + ' hours · ' + fmt(scenario.care.fundedValue)],
    ['Tax-Free Childcare top-up', fmt(scenario.care.topUp)],
    ['Childcare the family pays', fmt(scenario.care.familyCost)]
  ];
  scenario.adults.slice(0, hasPartner ? 2 : 1).forEach((adult, index) => {
    const parent = 'Parent ' + (index + 1);
    entries.push([parent + ' adjusted net income', fmt(adult.ani)]);
    entries.push([parent + ' Personal Allowance', fmt(adult.allowance)]);
    if (mode === 'sacrifice') {
      entries.push([parent + ' gross salary sacrifice', fmt(adult.grossReduction)]);
    } else if (mode !== 'cash') {
      entries.push([parent + ' payment and gross ANI reduction', fmt(adult.personalPayment) + ' paid · ' + fmt(adult.grossReduction) + ' gross']);
    }
  });
  for (const [label, value] of entries) {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    list.append(term, detail);
  }
  card.append(heading, list);
  return card;
}

function render() {
  const invalid = [...form.querySelectorAll('input[type="number"]')].find(input => !input.validity.valid);
  if (invalid) {
    error.textContent = 'Enter a valid value for ' + invalid.closest('label').textContent.trim() + '.';
    estimate.hidden = true;
    return;
  }
  error.textContent = '';
  const salaries = [byId('salary-1').valueAsNumber, byId('salary-2').valueAsNumber];
  const children = [...childList.children].map(row => {
    const field = name => row.querySelector('[data-field="' + name + '"]');
    return {
      stage: field('stage').value,
      hours: field('hours').valueAsNumber,
      taxFree: field('tax-free').checked,
      disabled: field('disabled').checked,
      quarterlyFees: Array(4).fill(field('fees').valueAsNumber / 4)
    };
  });
  const result = calculate({
    salaries, children, hourlyRate: byId('hourly-rate').valueAsNumber,
    taxFree: byId('tax-free').checked, funded: byId('funded').checked
  });
  const { cash, sacrifice, sipp, giftAid, cliff } = result;
  const cliffText = [fmt(result.supportAtRisk) + ' a year in childcare support depends on passing the income test.'];
  if (cliff && cliff.breakEven !== null) {
    cliffText.push('Holding the other parent’s pay fixed, moving the higher earner from £99,999 to £100,001 cuts annual family cash by '
      + fmt(cliff.loss) + ' (' + fmt(cliff.before) + ' to ' + fmt(cliff.after) + '). Gross pay of '
      + fmt(cliff.breakEven) + ' matches the £99,999 cash benchmark without a contribution.');
  } else if (!cliff) {
    cliffText.push('Both parents exceed the limit. Reducing only one parent’s income leaves the household above the limit.');
  } else {
    cliffText.push('At the entered childcare costs, moving from £99,999 to £100,001 leaves family cash at least as high.');
  }
  byId('cliff-summary').textContent = cliffText.join(' ');
  byId('contribution-summary').textContent = cash.passesIncomeTest
    ? 'The entered salaries already pass the £100,000 income test.'
    : 'Each contribution scenario targets £99,999 for every parent above £100,000. Changes in brackets are versus taking the pay as cash.';
  byId('scenarios').replaceChildren(
    scenarioCard('Take the pay as cash', cash, cash, salaries[1] > 0, 'cash'),
    scenarioCard('Pension salary sacrifice', sacrifice, cash, salaries[1] > 0, 'sacrifice'),
    scenarioCard('Relief-at-source SIPP', sipp, cash, salaries[1] > 0, 'sipp'),
    scenarioCard('Gift Aid donation', giftAid, cash, salaries[1] > 0, 'giftAid')
  );
  estimate.hidden = false;
}

function updateChildLabels() {
  [...childList.children].forEach((row, index) => {
    const label = 'Child ' + (index + 1);
    row.querySelector('legend').textContent = label;
    row.querySelector('.remove').setAttribute('aria-label', 'Remove ' + label.toLowerCase());
  });
}

function addChild(focus = false) {
  const row = byId('child-template').content.firstElementChild.cloneNode(true);
  row.querySelector('.remove').addEventListener('click', () => {
    const next = row.nextElementSibling ?? row.previousElementSibling;
    row.remove();
    updateChildLabels();
    (next?.querySelector('.remove') ?? addChildButton).focus();
    render();
  });
  childList.append(row);
  updateChildLabels();
  if (focus) row.querySelector('select').focus();
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
addChildButton.addEventListener('click', () => {
  addChild(true);
  render();
});
addChild();
addChild();
render();
