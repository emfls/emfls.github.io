import { simulate } from './model.mjs';

const form = document.querySelector('#assumptions');
const results = document.querySelector('#results');
const summary = document.querySelector('#summary');
const body = document.querySelector('#projection tbody');
const status = document.querySelector('#input-status');
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 2,
});

const cash = value => money.format(Math.round(value) || 0);
const show = (id, value) => { document.getElementById(id).textContent = value; };

function update() {
  const invalid = [...form.elements].find(field => field.willValidate && !field.validity.valid);
  if (invalid) {
    results.hidden = true;
    status.textContent = `${invalid.labels[0].textContent} — ${invalid.validationMessage}`;
    return;
  }

  const inputs = Object.fromEntries(
    [...new FormData(form)].map(([key, value]) => [key, Number(value)]),
  );
  const model = simulate(inputs);
  const { final, rows } = model;

  show('tax-first', cash(rows[0].annualTaxSavings));
  show('tax-final', cash(final.annualTaxSavings));
  show('tax-total', cash(final.cumulativeTaxSavings));
  show('converted', `${cash(final.converted)} · ${percent.format(final.convertedShare)}`);
  show('advantage', cash(final.advantageOverDirect));
  show('rate-effective', percent.format(model.effectiveRate));
  show('offset-equivalent', percent.format(model.offsetPreTaxRate));
  show('recycle-wealth', cash(final.recycleWealth));
  show('offset-wealth', cash(final.offsetWealth));
  show('direct-wealth', cash(final.directWealth));
  show('payment', cash(model.payment));
  show('shaved', model.yearsShaved === null
    ? 'Private debt remains at horizon'
    : `${model.yearsShaved} ${model.yearsShaved === 1 ? 'year' : 'years'} earlier`);
  show('cleared', model.privateDebtClearedYear === null
    ? `${cash(final.privateDebt)} private debt remaining`
    : model.privateDebtClearedYear === 0
      ? 'Private split cleared at the start'
      : `Private split cleared at the year ${model.privateDebtClearedYear} mark`);
  show('investment-debt', cash(final.investmentDebt));
  show('horizon-output', final.year);

  body.replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = row.year;
    tr.append(year);
    for (const field of ['privateDebt', 'investmentDebt', 'annualTaxSavings',
      'recycleFrankingCredit', 'offsetInterestSaved', 'recycleWealth', 'offsetWealth', 'directWealth']) {
      const cell = tr.insertCell();
      cell.textContent = cash(row[field]);
    }
    return tr;
  }));

  status.textContent = '';
  results.hidden = false;
  summary.textContent = `Year ${final.year} net wealth in Australian dollars. Debt recycling ${cash(final.recycleWealth)}, offset ${cash(final.offsetWealth)}, direct investing ${cash(final.directWealth)}.`;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
