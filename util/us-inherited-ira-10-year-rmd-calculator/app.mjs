import {calculateIRA, parseCents} from './model.mjs';

const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
const currency = cents => money.format(cents / 100);

export function summarize(form) {
  const growth = form.get('growth');
  const growthBps = parseCents(growth.replace(/^-/, '')) * (growth.startsWith('-') ? -1 : 1);
  const r = calculateIRA({
    deathYear: Number(form.get('deathYear')), beneficiaryAge: Number(form.get('beneficiaryAge')),
    ownerAge: Number(form.get('ownerAge')), postRbd: form.get('rbd') === 'after',
    balance: parseCents(form.get('balance')), growthBps,
    otherIncome: parseCents(form.get('income')), status: form.get('status'), shortfall: parseCents(form.get('shortfall')),
  });
  const rows = [
    ['Empty the account by', 'December 31, ' + r.deadline],
    ['Minimum plan · estimated federal tax on withdrawals', currency(r.minimumTax)],
    ['Smoothed plan · estimated federal tax on withdrawals', currency(r.smoothTax)],
    ['Federal tax difference · minimum minus smoothed', currency(r.minimumTax - r.smoothTax)],
    ['Smoothed withdrawal target, before annual RMD floors', currency(r.target)],
    ['Excise on entered shortfall · 25% / 10% with timely correction',
      currency(r.excise.standard) + ' / ' + currency(r.excise.timelyCorrection)],
  ];
  for (const [index, year] of r.minimumPlan.entries()) {
    const smooth = r.smoothPlan[index];
    const divisor = year.divisor === null ? '' : ' · divisor ' + (year.divisor / 10).toFixed(1);
    rows.push([
      year.calendarYear + ' · Year ' + year.year + divisor,
      'Minimum ' + currency(year.withdrawn) + ' (tax ' + currency(year.tax) + ')\n' +
        'Smoothed ' + currency(smooth.withdrawn) + ' (tax ' + currency(smooth.tax) +
        ', required ' + currency(smooth.minimum) + ')',
    ]);
  }
  return rows;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const hint = result.textContent.trim();
  form.addEventListener('input', () => { result.textContent = hint; });
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
      result.textContent = error instanceof RangeError ? error.message : 'Check the inputs and try again.';
    }
  });
}
