import {calculateRollover, parseCents} from './model.mjs';

export function summarize(form) {
  const result = calculateRollover({
    opened: form.get('opened'), transfer: form.get('transfer'),
    balance: parseCents(form.get('balance')), recent: parseCents(form.get('recent')),
    prior: parseCents(form.get('prior')), earned: parseCents(form.get('earned')),
    direct: parseCents(form.get('direct')), earlierThisYear: parseCents(form.get('earlierThisYear')),
    age50: form.has('age50'), confirmed: form.has('confirmed'),
  });
  const dollars = cents => '$' + Math.floor(cents / 100).toLocaleString('en-US') +
    '.' + String(cents % 100).padStart(2, '0');
  return [
    ['Estimated 2026 transfer', dollars(result.current)],
    ['15-year account rule', result.ageEligible ? 'Met' : 'Account too young on the transfer date'],
    ['Lookback and transfer confirmation', form.has('confirmed') ? 'Confirmed' : 'Confirm with your plan before calculating a transfer'],
    ['Balance after five-year exclusion', dollars(result.eligibleBalance)],
    ['Remaining lifetime room', dollars(result.lifetimeRoom)],
    ['2026 IRA room after compensation and other contributions', dollars(result.annualRoom)],
    ...result.schedule.map(row => [
      String(row.year) + ' projected transfer',
      dollars(row.amount) + ' · Remaining target ' + dollars(row.remaining),
    ]),
    ...(result.qualified && result.remaining > 0 ? [
      ['Unscheduled eligible amount', dollars(result.remaining) + ' under the 10-year projection'],
    ] : []),
  ];
}

const form = document.querySelector('#calculator');
const result = document.querySelector('#result');
form.addEventListener('input', () => { result.replaceChildren(); });
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const rows = summarize(new FormData(form));
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
    result.textContent = error instanceof RangeError ? error.message :
      "Check the inputs and try again.";
  }
});
