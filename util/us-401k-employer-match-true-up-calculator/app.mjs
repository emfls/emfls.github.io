import {calculateMatch, parseCents} from './model.mjs';

export function summarize(form) {
  const r = calculateMatch({
    salary: parseCents(form.get('salary')), age: Number(form.get('age')),
    catchUp: form.has('catchUp'), periods: Number(form.get('periods')),
    contributionRate: parseCents(form.get('contributionRate')), matchRate: parseCents(form.get('matchRate')),
    matchLimit: parseCents(form.get('matchLimit')), trueUp: form.has('trueUp'),
    compensationMethod: form.get('compensationMethod'),
  });
  const rows = [
    ['Match lost under selected plan', dollars(r.matchLost)],
    ['Estimated total employer match', dollars(r.totalMatch)],
    ['2026 elective deferral limit', dollars(r.annualLimit)],
    ['Annual pay eligible for matching', dollars(r.eligiblePay)],
    ['Paycheck reaching the IRS elective limit', r.capPaycheck === null ? 'Limit not reached' : '#' + r.capPaycheck],
    ['Total employee deferrals', dollars(r.deferred)],
    ['Match paid during the year', dollars(r.matchReceived)],
    ['Match based on annual pay and actual deferrals', dollars(r.annualMatch)],
    ['Timing loss if the plan has no true-up', dollars(r.timingGap)],
    ['Estimated true-up under selected plan', dollars(r.trueUpOwed)],
    ['Steady rate on eligible pay (rounded)', percent(r.steadyRate)],
    ['Steady deferral per paycheck (average)', dollars(r.steadyAmount)],
    ['Exact annual deferrals on the steady schedule', dollars(r.steadyTotal)],
    ['Employer match on the steady schedule', dollars(r.steadyMatch)],
    ['Full formula match subject to annual additions limit', dollars(r.fullMatch)],
    ['Steady match shortfall versus full formula', dollars(r.steadyShortfall)],
  ];
  const schedule = r.schedule.map(row => [row.paycheck, dollars(row.gross), dollars(row.eligible),
    dollars(row.deferral), dollars(row.match), dollars(row.steadyDeferral)]);
  return {rows, schedule};
}

const percent = rate => Math.floor(rate / 100) + '.' + String(rate % 100).padStart(2, '0') + '%';

function dollars(cents) {
  const amount = Math.abs(cents);
  return (cents < 0 ? '−' : '') + '$' + Math.floor(amount / 100).toLocaleString('en-US') +
    '.' + String(amount % 100).padStart(2, '0');
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const details = document.querySelector('#paycheck-details');
  const tableBody = details?.querySelector('tbody');
  const hint = result.textContent.trim();
  form.addEventListener('input', () => {
    result.textContent = hint;
    if (details) {
      details.hidden = true;
      details.open = false;
      tableBody.replaceChildren();
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const {rows, schedule} = summarize(new FormData(form));
      const list = document.createElement('dl');
      for (const [label, value] of rows) {
        const term = document.createElement('dt');
        const definition = document.createElement('dd');
        term.textContent = label;
        definition.textContent = value;
        list.append(term, definition);
      }
      result.replaceChildren(list);
      if (details) {
        const body = document.createDocumentFragment();
        for (const [paycheck, ...amounts] of schedule) {
          const row = document.createElement('tr');
          const label = document.createElement('th');
          label.scope = 'row';
          label.textContent = paycheck;
          row.append(label);
          for (const amount of amounts) {
            const cell = document.createElement('td');
            cell.textContent = amount;
            row.append(cell);
          }
          body.append(row);
        }
        tableBody.replaceChildren(body);
        details.hidden = false;
      }
    } catch (error) {
      result.textContent = error instanceof RangeError ? error.message : 'Check the inputs and try again.';
      if (details) details.hidden = true;
    }
  });
}
