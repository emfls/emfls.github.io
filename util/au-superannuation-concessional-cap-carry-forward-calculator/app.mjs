import {calculateSuper, HISTORY, parseCents} from './model.mjs';

export function summarize(form) {
  const amount = name => parseCents(form.get(name));
  const r = calculateSuper({
    earnings: amount('earnings'), otherEmployer: amount('otherEmployer'), voluntary: amount('voluntary'),
    taxableIncome: amount('taxableIncome'), divIncome: amount('divIncome'), balance: amount('balance'),
    unused: HISTORY.map((_, index) => amount('unused' + index)), medicare: form.has('medicare'),
  });
  const rows = [
    ['Net tax saving on in-cap voluntary contributions', dollars(r.netSaving)],
    ['Estimated 12% employer Super Guarantee', dollars(r.sg)],
    ['Total employer concessional contributions', dollars(r.employer)],
    ['General 2026–27 concessional cap', dollars(r.currentCap)],
    ['30 June 2026 balance test', r.eligible ? 'Eligible for unused carry-forward amounts' : 'Ineligible at A$500,000 or above'],
    ['Carry-forward available before contributions', dollars(r.carryAvailable)],
    ['Combined current and carry-forward cap', dollars(r.available)],
    ['Total concessional contributions', dollars(r.contributions)],
    ['Contributions within the cap', dollars(r.inCap)],
    ['Remaining 2026–27 contribution room', dollars(r.room)],
    ['Excess contributions', dollars(r.excess)],
    ...HISTORY.map(({year}, index) => [year + ' carry-forward used', dollars(r.carryUsed[index])]),
    ['Unused eligible carry-forward room after contributions (before expiry)', dollars(r.carryRemaining)],
    ['2021–22 room expiring after 30 June 2027', dollars(r.oldestRemaining)],
    ['Voluntary contributions included in savings estimate', dollars(r.savingEligible)],
    ['Personal income tax and selected Medicare levy reduction', dollars(r.taxReduction)],
    ['Estimated 15% fund tax on in-cap contributions', dollars(r.fundTax)],
    ['Fund tax added by in-cap voluntary contributions', dollars(r.voluntaryFundTax)],
    ['Total estimated Division 293 tax', dollars(r.divTax)],
    ['Division 293 tax added by in-cap voluntary contributions', dollars(r.incrementalDivTax)],
  ];
  return {rows};
}

function dollars(cents) {
  const amount = Math.abs(cents);
  return (cents < 0 ? '−' : '') + 'A$' + Math.floor(amount / 100).toLocaleString('en-AU') +
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
