import {calculateSale, parseCents} from './model.mjs';

export function summarize(form) {
  const amount = name => parseCents(form.get(name));
  const r = calculateSale({
    sale: amount('sale'), selling: amount('selling'), purchase: amount('purchase'), buying: amount('buying'),
    improvements: amount('improvements'), depreciation: amount('depreciation'), nonqualified: amount('nonqualified'),
    ordinary: amount('ordinary'), magi: amount('magi'), status: form.get('status'),
    qualifies: form.has('qualifies'), longTerm: form.has('longTerm'),
  });
  const rows = [
    ['Estimated federal tax from sale', dollars(r.totalTax)],
    ['Net sale proceeds', dollars(r.amountRealized)],
    ['Adjusted cost basis', dollars(r.adjustedBasis)],
    ['Realized gain or loss', dollars(r.gain)],
    ['Section 121 exclusion limit', dollars(r.exclusionLimit)],
    ['Gain excluded under Section 121', dollars(r.excluded)],
    ['Total taxable gain', dollars(r.taxableGain)],
    ['Unrecaptured Section 1250 gain', dollars(r.section1250)],
    ['Tax on unrecaptured Section 1250 gain', dollars(r.tax1250)],
    ['Regular taxable long-term gain', dollars(r.taxableLtcg)],
    ['Regular gain at 0% / 15% / 20%', r.bands.map(dollars).join(' / ')],
    ['Tax on regular long-term gain before ordinary-rate limit', dollars(r.taxRegular)],
    ['Ordinary-rate limit reduction', dollars(r.ordinaryRateReduction)],
    ['Taxable short-term gain', dollars(r.taxableShortTerm)],
    ['Tax on short-term gain', dollars(r.taxShortTerm)],
    ['Net Investment Income Tax on sale', dollars(r.niit)],
  ];
  return {rows};
}

function dollars(cents) {
  const amount = Math.abs(cents);
  return (cents < 0 ? '−' : '') + '$' + Math.floor(amount / 100).toLocaleString('en-US') +
    '.' + String(amount % 100).padStart(2, '0');
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const hint = result.textContent.trim();
  form.addEventListener('input', () => {
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
}
