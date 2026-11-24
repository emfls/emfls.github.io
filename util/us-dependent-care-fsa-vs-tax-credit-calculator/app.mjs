import {compareCare, parseCents} from './model.mjs';

export function summarize(form) {
  const r = compareCare({
    status: form.get('status'), people: Number(form.get('people')), agi: parseCents(form.get('agi')),
    expenses: parseCents(form.get('expenses')), wages: parseCents(form.get('wages')),
    spouse: parseCents(form.get('spouse')), planLimit: parseCents(form.get('planLimit')),
    federal: parseCents(form.get('federal')), state: parseCents(form.get('state')),
    liability: parseCents(form.get('liability')),
  });
  return [
    ['Highest estimated combined savings', currency(r.best.total)],
    ['Credit only · no FSA election', currency(r.credit.credit)],
    ['Maximum usable FSA election', currency(r.full.election)],
    ['Maximum election · FSA tax savings alone', currency(r.full.savings)],
    ['Maximum election · combined with any remaining credit', currency(r.full.total)],
    ['Best split · FSA election', currency(r.best.election)],
    ['Best split · FSA tax savings', currency(r.best.savings)],
    ['Best split · credit expense base', currency(r.best.creditBase)],
    ['Best split · estimated AGI and credit rate', currency(r.best.agi) + ' · ' + r.best.rate + '%'],
    ['Best split · usable federal credit', currency(r.best.credit)],
    ['Best split · Social Security and Medicare savings', currency(r.best.socialSecurity + r.best.medicare)],
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
