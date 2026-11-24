import {calculateRepeal, parseCents} from './model.mjs';

const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
const currency = cents => money.format(cents / 100);

export function summarize(form) {
  const mode = form.get('mode');
  const cents = name => parseCents(form.get(name));
  const result = calculateRepeal({
    mode, fullBenefit: cents('fullBenefit'), months: Number(form.get('months')),
    ...(mode === 'exact' && {previousWepReduction: cents('previousWepReduction')}),
    ...(mode !== 'exact' && {nonCoveredPension: cents('nonCoveredPension')}),
    ...(mode === 'estimate' && {aime: cents('aime'), years: Number(form.get('years'))}),
  });
  const rows = [
    ['Monthly amount restored', currency(result.monthlyIncrease)],
    ['Estimated new monthly benefit before withholding', currency(result.newMonthlyBenefit)],
    ['Estimated previous monthly benefit', currency(result.oldMonthlyBenefit)],
    ['Ongoing increase over 12 months', currency(result.annualIncrease)],
    ['Retroactive estimate for the eligible months entered', currency(result.retroactiveIncrease)],
  ];
  if (form.has('showTenYear')) rows.push(['10-year increase at a flat monthly amount', currency(result.tenYearIncrease)]);
  return {rows};
}

function updateMode(form) {
  for (const group of form.querySelectorAll('[data-modes]')) {
    const visible = group.dataset.modes.split(' ').includes(form.elements.mode.value);
    group.hidden = !visible;
    for (const input of group.querySelectorAll('input')) input.disabled = !visible;
  }
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  updateMode(form);
  const hint = result.textContent.trim();
  form.addEventListener('input', () => {
    updateMode(form);
    result.textContent = hint;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const {rows} = summarize(new FormData(form));
      const list = document.createElement('dl');
      for (const [label, value] of rows) {
        const term = document.createElement('dt');
        const definition = document.createElement('dd');
        term.textContent = label;
        definition.textContent = value;
        list.append(term, definition);
      }
      result.replaceChildren(list);
    } catch (error) {
      result.textContent = error instanceof RangeError ? error.message : 'Check the inputs and try again.';
    }
  });
  form.querySelector('button[type=submit]').disabled = false;
}
