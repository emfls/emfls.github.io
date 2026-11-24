import { basicHighWeekBounds, comparePlans } from './model.mjs';

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const signedMoney = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', signDisplay: 'exceptZero',
});
const form = document.querySelector('#qpip-form');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const earningsNote = document.querySelector('#earnings-note');
const highWeekNote = document.querySelector('#high-week-note');
const fields = [...form.querySelectorAll('input')];
const birth = 'Birth parent';
const other = 'Other parent';

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function renderPlan(id, plan) {
  const container = document.querySelector(`#${id}-result [data-plan-details]`);
  const totals = document.createElement('dl');
  const rows = [
    ['Gross benefits', money.format(plan.totalBenefits)],
    ['Benefit weeks across both parents', plan.benefitWeeks],
    ['Sharing bonus', plan.bonusWeeks ? `${plan.bonusWeeks} weeks · ${money.format(plan.bonusBenefits)}` : '0 weeks · $0.00'],
    ['Salary after leave', money.format(plan.salaryIncome)],
    ['Total first-year income', money.format(plan.cash52)],
  ];
  for (const [label, value] of rows) {
    totals.append(element('dt', label), element('dd', value));
  }

  const breakdowns = plan.parents.map((parent, index) => {
    const group = document.createElement('details');
    group.append(element('summary', `${index === 0 ? birth : other} · ${parent.leaveWeeks} paid weeks`));
    const amounts = document.createElement('ul');
    for (const { label, weeks, rate, weeklyBenefit } of parent.segments) {
      amounts.append(element('li', `${label} · ${weeks} ${weeks === 1 ? 'week' : 'weeks'} at ${rate}% · ${money.format(weeklyBenefit)}/week`));
    }
    amounts.append(element('li', `${parent.workWeeks} weeks at work · ${money.format(parent.salaryIncome)} in salary`));
    group.append(amounts);
    return group;
  });
  const openStates = [...container.querySelectorAll('details')].map(detail => detail.open);
  breakdowns.forEach((group, index) => { group.open = openStates[index] ?? true; });
  container.replaceChildren(totals, ...breakdowns);
}

function verdict(label, difference) {
  if (difference === 0) return `${label} is tied.`;
  return `${difference > 0 ? 'Basic' : 'Special'} leads on ${label.toLowerCase()} by ${money.format(Math.abs(difference))}.`;
}

function update() {
  const values = Object.fromEntries(fields.map(field => [field.name, field.valueAsNumber]));
  values.bonusRecipient = form.elements.bonusRecipient.value;
  const basicWeeks = values.basicOtherWeeks;
  if (Number.isInteger(basicWeeks) && basicWeeks >= 0 && basicWeeks <= 32) {
    const bounds = basicHighWeekBounds(basicWeeks);
    const highInput = form.elements.basicOtherHighWeeks;
    highInput.min = String(bounds.min);
    highInput.max = String(bounds.max);
    highWeekNote.textContent = bounds.min === bounds.max
      ? `This split requires ${bounds.min} of the first seven shareable weeks to go to the other parent.`
      : `Enter ${bounds.min}–${bounds.max} based on who takes the first seven shareable weeks.`;
  }

  let comparison;
  try {
    comparison = comparePlans(values);
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    results.hidden = true;
    earningsNote.hidden = true;
    error.textContent = failure.message;
    error.hidden = false;
    return;
  }

  const { basic, special, benefitDifference, cashDifference, ei, eiGap } = comparison;
  error.hidden = true;
  earningsNote.hidden = Math.min(values.birthSalary, values.otherSalary) >= 2000;
  results.hidden = false;
  document.querySelector('#benefit-verdict').textContent = verdict('Gross benefits', benefitDifference);
  document.querySelector('#cash-verdict').textContent = verdict('First-year household income', cashDifference);
  renderPlan('basic', basic);
  renderPlan('special', special);

  for (const name of ['standard', 'extended']) {
    document.querySelector(`#ei-${name}`).textContent = money.format(ei[name].totalBenefits);
    document.querySelector(`#basic-${name}`).textContent = signedMoney.format(eiGap.basic[name]);
    document.querySelector(`#special-${name}`).textContent = signedMoney.format(eiGap.special[name]);
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
