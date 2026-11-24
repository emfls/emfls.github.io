import {checkInteger, parseCents, planLadder, rothWithdrawal} from './model.mjs';

const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
const currency = cents => money.format(cents / 100);

export function summarize(form) {
  const cents = name => parseCents(form.get(name));
  const age = cents('age');
  const ageMonths = checkInteger(age / 50, 0, 200, 'Age in half-year increments') * 6;
  const plan = planLadder({
    status: form.get('status'), otherIncome: cents('otherIncome'), annualSpending: cents('annualSpending'),
    cash: cents('cash'), brokerage: cents('brokerage'), contributions: cents('contributions'),
    inflationBps: cents('inflation'), ageMonths,
  });
  const first = plan.ladder[0];
  const tax = plan.firstTax;
  const effectiveRate = tax.effectiveBps === null ? '—' : (tax.effectiveBps / 100).toFixed(2) + '%';
  const rows = [
    [plan.bridgeNet < 0 ? 'Five-year bridge funding gap' : 'Five-year bridge surplus', currency(Math.abs(plan.bridgeNet))],
    ['2026 gross conversion target', currency(first.conversion)],
    ['2026 incremental federal conversion tax', currency(tax.tax)],
    ['Effective federal rate on conversion', effectiveRate],
    ['Remaining conversion room at 0%', currency(tax.headroom0)],
    ['Remaining conversion room within the 10% band', currency(tax.headroom10)],
    ['Remaining conversion room within the 12% band', currency(tax.headroom12)],
    ['Total room through the top of the 12% bracket', currency(tax.headroomTo12)],
    ['2031 potential 10% early-distribution tax avoided', currency(first.directPenaltyAvoided)],
  ];
  const withdrawal = checkInteger(cents('withdrawal'), 0, 10_000_000_000, 'Withdrawal');
  if (withdrawal > 0) {
    const year = Number(form.get('withdrawalYear'));
    const conversions = [1, 2].flatMap(index => {
      const taxable = cents('taxable' + index);
      const nontaxable = cents('nontaxable' + index);
      return taxable || nontaxable ? [{year: Number(form.get('conversionYear' + index)), taxable, nontaxable}] : [];
    });
    const result = rothWithdrawal({
      year, ageMonths: ageMonths + (year - 2026) * 12, withdrawal,
      contributions: cents('remainingBasis'), conversions, earnings: cents('earnings'),
      firstRothYear: Number(form.get('firstRothYear')),
    });
    rows.push(
      ['Withdrawal from regular contribution basis', currency(result.regularUsed)],
      ['Withdrawal from previously taxed conversion principal', currency(result.taxableConvertedUsed)],
      ['Withdrawal from nontaxable conversion principal', currency(result.nontaxableConvertedUsed)],
      ['Early recapture tax on conversion principal', currency(result.recapturePenalty)],
      ['Earnings withdrawn / taxable earnings', currency(result.earningsUsed) + ' / ' + currency(result.taxableEarnings)],
      ['Additional 10% tax on earnings', currency(result.earningsPenalty)],
      ['Withdrawal amount beyond entered Roth balance', currency(result.unfunded)],
    );
  }
  return {rows, tables: [
    {
      title: 'Five-year bridge before the first unlock',
      headers: ['Year', 'Spending', 'Assets left / shortfall'],
      data: plan.bridge.map(row => [row.year, currency(row.spending), currency(row.remaining)]),
    },
    {
      title: 'Ten annual conversions and their unlock dates',
      headers: ['Conversion year', 'Conversion target', 'Five-year unlock', 'Potential 10% tax avoided'],
      data: plan.ladder.map(row => [
        row.year, currency(row.conversion), 'Jan 1, ' + row.unlockYear, currency(row.directPenaltyAvoided),
      ]),
    },
  ]};
}

function renderTable({title, headers, data}) {
  const box = document.createElement('div');
  box.className = 'table-wrap';
  box.tabIndex = 0;
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', title);
  const table = document.createElement('table');
  table.createCaption().textContent = title;
  const header = table.createTHead().insertRow();
  for (const label of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of data) {
    const tr = body.insertRow();
    for (const value of row) tr.insertCell().textContent = value;
  }
  box.append(table);
  return box;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const schedules = document.querySelector('#schedules');
  const hint = result.textContent.trim();
  form.addEventListener('input', () => {
    result.textContent = hint;
    schedules.replaceChildren();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const {rows, tables} = summarize(new FormData(form));
      const list = document.createElement('dl');
      for (const [label, value] of rows) {
        const term = document.createElement('dt');
        const definition = document.createElement('dd');
        term.textContent = label;
        definition.textContent = value;
        list.append(term, definition);
      }
      result.replaceChildren(list);
      schedules.replaceChildren(...tables.map(renderTable));
    } catch (error) {
      result.textContent = error instanceof RangeError ? error.message : 'Check the inputs and try again.';
      schedules.replaceChildren();
    }
  });
  form.querySelector('button[type=submit]').disabled = false;
}
