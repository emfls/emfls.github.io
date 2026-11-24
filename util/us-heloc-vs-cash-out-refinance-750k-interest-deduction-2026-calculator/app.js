import { calculate } from './model.mjs';

const form = document.querySelector('#loan-inputs');
const results = document.querySelector('#results');
const errorMessage = document.querySelector('#input-error');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const names = {
  keep: 'Keep Low-Rate Mortgage + HELOC',
  refi: 'Cash-Out Refinance'
};

const dollars = value => currency.format(value);
const rate = value => value === null ? '—' : `${percent.format(value)}%`;
const text = (id, content) => { document.getElementById(id).textContent = content; };

function element(tag, content, parent) {
  const node = document.createElement(tag);
  node.textContent = content;
  parent.append(node);
  return node;
}

function renderMetrics(keep, refi, drawYears, cashNeeded) {
  const items = [
    ['Initial monthly payment', dollars(keep.payment), dollars(refi.payment)],
    ['Combined payment at HELOC repayment start',
      drawYears > 0 && cashNeeded > 0 ? dollars(keep.repaymentPayment) : '—', '—'],
    ['Opening note rate (blended for HELOC)', rate(keep.noteRate), rate(refi.noteRate)],
    ['Modeled APR with closing costs', rate(keep.apr), rate(refi.apr)],
    ['Upfront closing costs', dollars(keep.fees), dollars(refi.fees)],
    ['First-year deductible interest', dollars(keep.yearOne.deductible), dollars(refi.yearOne.deductible)],
    ['Of which, deductible on new cash', dollars(keep.yearOne.addedDeductible), dollars(refi.yearOne.addedDeductible)],
    ['First-year non-deductible interest', dollars(keep.yearOne.nonDeductible), dollars(refi.yearOne.nonDeductible)],
    ['First-year estimated federal tax savings', dollars(keep.yearOne.savings), dollars(refi.yearOne.savings)]
  ];
  const rows = document.createDocumentFragment();
  for (const [label, keepValue, refiValue] of items) {
    const row = element('tr', '', rows);
    element('th', label, row).scope = 'row';
    element('td', keepValue, row);
    element('td', refiValue, row);
  }
  document.getElementById('metrics').replaceChildren(rows);
}

function renderHorizons(horizons) {
  const cards = document.createDocumentFragment();
  for (const { years, keep, refi, winner, difference } of horizons) {
    const article = element('article', '', cards);
    element('h3', `${years} years`, article);
    const lead = winner === 'tie'
      ? 'Costs tie to the cent'
      : `${names[winner]} costs ${dollars(difference)} less`;
    element('p', lead, article).className = 'leading';
    const list = element('dl', '', article);
    for (const [label, key] of [['Total interest', 'interest'], ['After-tax cost', 'cost'], ['Remaining principal', 'balance']]) {
      element('dt', label, list);
      const values = element('dd', '', list);
      element('small', `Keep + HELOC: ${dollars(keep[key])}`, values);
      element('small', `Cash-out refi: ${dollars(refi[key])}`, values);
    }
  }
  document.getElementById('horizons').replaceChildren(cards);
}

function renderBreakEven({ option, month }) {
  if (!option) {
    text('break-even', 'Closing-cost break-even: Upfront costs are equal at cent precision.');
  } else if (month === null) {
    text('break-even', `Closing-cost break-even: ${names[option]} never recovers its higher upfront costs over the modeled loan terms.`);
  } else {
    text('break-even', `Closing-cost break-even: ${names[option]} first recovers its higher upfront costs in month ${month}.`);
  }
}

function update() {
  const input = Object.fromEntries(
    Array.from(form.elements)
      .filter(control => control.name)
      .map(control => [control.name, control.type === 'number' ? control.valueAsNumber : control.value])
  );
  let result;
  try {
    result = calculate(input);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    results.hidden = true;
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    return;
  }
  errorMessage.hidden = true;
  errorMessage.textContent = '';

  const { equity, taxLimits, keep, refi, horizons, breakEven } = result;
  const tenYear = horizons[1];
  const lead = tenYear.winner === 'tie'
    ? '10-year after-tax costs tie to the cent.'
    : `10-year estimate: ${names[tenYear.winner]} costs ${dollars(tenYear.difference)} less.`;
  text('winner', equity.eligible ? lead : `Over the lender limit. Hypothetical comparison. ${lead}`);
  const equityText = `Available borrowing: ${dollars(equity.available)}. Proposed LTV / CLTV: ${rate(equity.cltv)} (limit ${rate(input.maxCltv)}).`;
  text('eligibility', equity.eligible ? equityText : `${equityText} The combined balance exceeds the limit by ${dollars(equity.excess)}.`);
  text('deduction-room', `Opening room under the new acquisition-debt cap: ${dollars(taxLimits.openingRoom)}. The modeled amount can change as principal is repaid.`);

  renderBreakEven(breakEven);
  renderMetrics(keep, refi, input.drawYears, input.cashNeeded);
  renderHorizons(horizons);
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
