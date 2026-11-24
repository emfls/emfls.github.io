import { calculateAdoptionCredit, projectCarryforward } from './model.mjs';

const form = document.querySelector('#adoption-form');
const results = document.querySelector('#scenario-results');
const error = document.querySelector('#input-error');
const futureTaxInputs = [...form.querySelectorAll('[data-future-tax]')];
const scheduleRows = [...document.querySelectorAll('#carryforward-rows tr')];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 4 });

function render() {
  try {
    const { numChildren, totalExpenses, employerExclusion, isSpecialNeeds, magi, federalTaxLiability } = form.elements;
    const credit = calculateAdoptionCredit({
      numChildren: numChildren.valueAsNumber,
      totalExpenses: totalExpenses.valueAsNumber,
      employerExclusion: employerExclusion.valueAsNumber,
      isSpecialNeeds: isSpecialNeeds.checked,
      magi: magi.valueAsNumber,
      federalTaxLiability: federalTaxLiability.valueAsNumber,
    });
    const schedule = projectCarryforward(credit.fiveYearCarryforward,
      futureTaxInputs.map(input => input.valueAsNumber));

    for (const output of results.querySelectorAll('[data-result]')) {
      const key = output.dataset.result;
      output.textContent = (key === 'phaseOutFactor' ? percent : money).format(credit[key]);
    }
    schedule.forEach(({ used, remaining, expired }, index) => {
      const [, usedCell, remainingCell, expiredCell] = scheduleRows[index].cells;
      usedCell.textContent = money.format(used);
      remainingCell.textContent = money.format(remaining);
      expiredCell.textContent = money.format(expired);
    });
    error.textContent = '';
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    results.hidden = true;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
