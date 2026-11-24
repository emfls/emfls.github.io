import {calculateEV, parseCents} from './model.mjs';

export function summarize(form) {
  const r = calculateEV({
    salary: parseCents(form.get('salary')), monthlySacrifice: parseCents(form.get('monthlySacrifice')),
    p11d: parseCents(form.get('p11d')),
  });
  return [
    ['Estimated monthly take-home cost', currency(r.monthlyCost)],
    ['Annual take-home cost', currency(r.netCost)],
    ['Annual gross salary sacrifice', currency(r.sacrifice)],
    ['Annual EV benefit tax at the applicable bands', currency(r.bikTax)],
    ['Annual income tax before → after (including EV benefit)', currency(r.taxBefore) + ' → ' + currency(r.taxAfter)],
    ['Annual employee NI before → after', currency(r.niBefore) + ' → ' + currency(r.niAfter)],
    ['Tax and NI saved before benefit tax', currency(r.grossSavings) + ' · ' + (r.reliefBps / 100).toFixed(2) + '%'],
    ['Adjusted net income including EV benefit', currency(r.ani)],
    ['Moves from above £100,000 to £100,000 or below',
      r.crossesChildcareThreshold ? 'Yes · check all other eligibility conditions' : 'No'],
    ...r.schedule.map(row => [row.year + ' taxable EV benefit (' + row.rate + '%)', currency(row.value)]),
  ];
}

const currency = pence => new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'}).format(pence / 100);

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
