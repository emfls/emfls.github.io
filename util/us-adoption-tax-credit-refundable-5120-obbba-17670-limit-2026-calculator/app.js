import { calculateAdoptionCredit, projectCarryforward } from './model.mjs';

const form = document.querySelector('#adoption-form');
const count = document.querySelector('#child-count');
const childList = document.querySelector('#children');
const childTemplate = document.querySelector('#child-template');
const estimate = document.querySelector('#estimate');
const error = document.querySelector('#estimate-error');
const creditDetail = document.querySelector('#credit-detail');
const exclusionDetail = document.querySelector('#exclusion-detail');
const tracker = document.querySelector('#tracker-status');
const taxInputs = Array.from(document.querySelectorAll('[name="futureTax"]'));
const priorInputs = Array.from(form.querySelectorAll('[name="priorCarry"]'));
const usedCells = document.querySelectorAll('[data-year-used]');
const balanceCells = document.querySelectorAll('[data-year-balance]');
const moneyOutputs = estimate.querySelectorAll('[data-money]');
const childRows = [];
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percentages = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 3 });
const money = value => dollars.format(value);

function amount(input) {
  if (!input.validity.valid) {
    const label = input.labels[0]?.firstChild.textContent.trim() || input.getAttribute('aria-label');
    throw new RangeError(`Check “${label}”. Enter a number within the field’s allowed range with up to two decimal places.`);
  }
  return input.valueAsNumber;
}

function readChildren() {
  if (!count.validity.valid) {
    throw new RangeError(`Enter a whole number from ${count.min} to ${count.max} for eligible children.`);
  }
  const needed = count.valueAsNumber;
  while (childRows.length < needed) {
    const row = childTemplate.content.firstElementChild.cloneNode(true);
    const index = childRows.length;
    row.querySelector('legend').textContent = `Child ${index + 1}`;
    if (index === 0) {
      row.querySelector('[name="grossExpenses"]').value = '24500';
      row.querySelector('[name="employerBenefit"]').value = '5000';
    }
    childList.append(row);
    childRows.push(row);
  }

  childRows.forEach((row, index) => {
    row.hidden = index >= needed;
    row.disabled = row.hidden;
    row.querySelector('[name="qualifiedPlan"]').disabled = !row.querySelector('[name="specialNeeds"]').checked;
  });

  return childRows.slice(0, needed).map(row => {
    const child = {};
    for (const input of row.querySelectorAll('input')) {
      child[input.name] = input.type === 'checkbox' ? input.checked : amount(input);
    }
    return child;
  });
}

function renderTracker(carryforward) {
  usedCells.forEach(cell => { cell.textContent = '—'; });
  balanceCells.forEach(cell => { cell.textContent = '—'; });
  if (carryforward === undefined) {
    tracker.textContent = 'Enter valid 2026 inputs to project a balance.';
    return;
  }

  try {
    const years = projectCarryforward(carryforward, taxInputs.map(amount));
    years.forEach((year, index) => {
      usedCells[index].textContent = money(year.used);
      balanceCells[index].textContent = money(year.remaining);
    });
    const expired = years.at(-1).expires;
    tracker.textContent = `2026 credit projected to expire after 2031: ${money(expired)}.`;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    tracker.textContent = problem.message;
  }
}

function update() {
  let result;
  try {
    const children = readChildren();
    if (form.elements.filing.value === 'separate') {
      throw new RangeError('Confirm that you qualify under the IRS separate-filer rules before estimating your new credit or exclusion.');
    }
    result = calculateAdoptionCredit({
      children,
      creditMagi: amount(form.elements.creditMagi),
      exclusionMagi: amount(form.elements.exclusionMagi),
      availableTax: amount(form.elements.availableTax),
      priorCarry: priorInputs.map(amount)
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    estimate.hidden = true;
    error.textContent = problem.message;
    renderTracker();
    return;
  }

  error.textContent = '';
  for (const output of moneyOutputs) {
    output.textContent = money(result[output.dataset.money]);
  }
  creditDetail.textContent = `Credit basis retained after MAGI phase-out: ${percentages.format(result.creditFactor)}. Older credit used in 2026: ${money(result.priorOffset)}. Older balance carried to 2027: ${money(result.priorCarried)}. Older credit expiring after 2026: ${money(result.priorExpiring)}.`;
  exclusionDetail.textContent = `Exclusion basis retained after MAGI phase-out: ${percentages.format(result.exclusionFactor)}. A negative taxable benefits adjustment reduces the income reported on Form 1040 line 1f.`;
  estimate.hidden = false;
  renderTracker(result.carryforward);
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
taxInputs.forEach(input => input.addEventListener('input', update));
update();
