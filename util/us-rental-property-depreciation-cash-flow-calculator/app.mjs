import {calculateRental, A6_FIRST_YEAR, parseCents} from './model.mjs';

const usd = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});
const currency = cents => usd.format(cents / 100);
const percent = bp => bp === null ? 'Unavailable (zero denominator)' : (bp / 100).toFixed(2) + '%';

export function summarize(form) {
  const cents = name => parseCents(form.get(name));
  const num = name => Number(form.get(name));
  const month = num('month');
  const year = num('year');
  const r = calculateRental({
    price:cents('price'), closing:cents('closing'), land:cents('land'), month, year,
    annualRent:cents('annualRent'), vacancy:cents('vacancy'), expenses:cents('expenses'),
    loan:cents('loan'), interestRate:cents('interestRate'), term:num('term'), invested:cents('invested'),
    status:form.get('status'), magi:cents('magi'), active:form.has('active'), taxRate:num('taxRate') * 100,
    passiveIncome:cents('passiveIncome'),
  });
  return {rows:[
    ['Pre-tax cash flow · year ' + year, currency(r.cashFlow)],
    ['Depreciable building basis', currency(r.basis)],
    ['First-year depreciation · ' + (A6_FIRST_YEAR[month - 1] / 1000).toFixed(3) + '%', currency(r.schedule[0])],
    ['Modeled-year depreciation', currency(r.annualDep)],
    ['Final recovery year · year ' + r.schedule.length, currency(r.schedule.at(-1))],
    ['Effective gross rental income', currency(r.gross)],
    ['Net operating income', currency(r.noi)],
    ['Cap rate', percent(r.capRate)],
    ['Scheduled monthly principal and interest', currency(r.debt.payment)],
    ['Annual debt service · year ' + year, currency(r.debt.debt)],
    ['Mortgage interest · year ' + year, currency(r.debt.interest)],
    ['Year 1 mortgage interest / principal', currency(r.firstDebt.interest) + ' / ' + currency(r.firstDebt.debt - r.firstDebt.interest)],
    ['Cash-on-cash return', percent(r.cashReturn)],
    ['Taxable rental income before passive loss limits', currency(r.taxable)],
    ['Maximum §469(i) special allowance', currency(r.allowance)],
    ['Currently deductible passive loss', currency(r.deducted)],
    ['Loss used against passive income / special allowance', currency(r.passiveOffset) + ' / ' + currency(r.specialDeduction)],
    ['Estimated suspended passive loss', currency(r.suspended)],
    ['Estimated current federal loss tax shield', currency(r.shield)],
  ]};
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
  form.querySelector('button[type=submit]').disabled = false;
}
