import {calculateRoom, parseCents} from './model.mjs';

export function summarize(form) {
  const r = calculateRoom({
    age: Number(form.get('age')), salary: parseCents(form.get('salary')),
    deferred: parseCents(form.get('deferred')), employer: parseCents(form.get('employer')),
    employerRate: parseCents(form.get('employerRate')), catchUp: form.has('catchUp'),
    afterTax: form.has('afterTax'), inPlan: form.has('inPlan'), inService: form.has('inService'),
  });
  return [
    ['Potential after-tax contribution room under selected plan',
      r.eligible ? currency(r.available) : 'Plan features unconfirmed or unavailable'],
    ['After-tax room under federal limits alone', currency(r.room)],
    ['Eligible compensation for employer percentage', currency(r.eligiblePay)],
    ['Employer additions entered or estimated', currency(r.employer)],
    ['Base annual additions ceiling for entered compensation', currency(r.baseCeiling)],
    ['Age-based catch-up limit with plan permission', currency(r.catchUp)],
    ['Statutory maximum with applicable catch-up', currency(r.statutoryTotal)],
    ['Entered additions above base ceiling', currency(r.excess)],
  ];
}

const currency = cents => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const hint = result.textContent.trim();
  form.addEventListener('input', () => { result.textContent = hint; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const list = document.createElement('dl');
      for (const [label, value] of summarize(new FormData(form))) {
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
}
