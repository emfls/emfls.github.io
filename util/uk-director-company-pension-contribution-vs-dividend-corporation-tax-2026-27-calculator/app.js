import { compareExtraction } from './model.mjs';

const form = document.getElementById('calculator');
const results = document.getElementById('results');
const error = document.getElementById('error');
const warning = document.getElementById('pension-warning');
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });
const routeNames = { pension: 'Company SIPP', dividend: 'Dividend', bonus: 'Director bonus' };
function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function amount(name) {
  const field = form.elements.namedItem(name);
  if (field.validity.badInput) throw new RangeError('Enter a valid number for each field.');
  return field.value === '' && !field.required ? 0 : field.valueAsNumber;
}

function renderRoute(name, route, withdrawalTax = 0) {
  const values = { ...route, cash: name === 'pension' ? 0 : route.net, withdrawalTax };
  for (const [key, value] of Object.entries(values)) {
    setText(`${name}-${key}`, currency.format(value));
  }
}

function update() {
  try {
    const result = compareExtraction({
      profit: amount('profit'), slice: amount('slice'), salary: amount('salary'),
      dividends: amount('dividends'), otherIncome: amount('otherIncome'), associates: amount('associates'),
      qualifyingDistributions: amount('qualifyingDistributions'), otherPension: amount('otherPension'),
      annualAllowance: amount('annualAllowance'), carryForward: amount('carryForward'),
      mpaaRemaining: form.elements.namedItem('mpaaApplies').checked ? amount('mpaaRemaining') : null,
      retirementRate: amount('retirementRate') / 100, lumpSumAllowance: amount('lumpSumAllowance')
    });
    error.textContent = '';
    results.hidden = false;

    const { pension, dividend, bonus, allowance, retirement, winner } = result;
    renderRoute('pension', pension, retirement.tax);
    renderRoute('dividend', dividend);
    renderRoute('bonus', bonus);

    const difference = pension.net - dividend.net;
    const absolute = Math.abs(difference);
    const relative = dividend.net > 0 ? ` (${percent.format(absolute / dividend.net)})` : '';
    setText('pension-vs-dividend', absolute < 0.005
      ? 'Company SIPP and dividend are level on the modelled tax assumptions.'
      : `After estimated withdrawal tax, the SIPP is worth ${currency.format(absolute)}${relative} ${difference > 0 ? 'more' : 'less'} than the net dividend.`);
    setText('upfront-saving', currency.format(result.upfrontSaving));
    setText('corp-saving', currency.format(result.corporationTaxSaved));
    setText('effective-corp', pension.gross > 0 ? percent.format(result.corporationTaxSaved / pension.gross) : '—');
    setText('tax-free-cash', currency.format(retirement.taxFree));

    warning.classList.toggle('warning', allowance.excess > 0);
    warning.textContent = allowance.excess > 0
      ? `${currency.format(allowance.excess)} exceeds the available pension allowance. An annual allowance charge may reduce the pension value shown. The pension comparison excludes that charge.`
      : `${currency.format(allowance.remaining)} of the entered pension allowance remains after this contribution.`;
    if (winner === null) {
      setText('winner', 'Overall winner cannot be determined without the annual allowance charge.');
    } else if (winner.route === 'tie') {
      setText('winner', 'The top routes are level to the nearest penny.');
    } else {
      const boost = winner.boost === null ? '' : ` (${percent.format(winner.boost)})`;
      setText('winner', `${routeNames[winner.route]} leads by ${currency.format(winner.difference)}${boost} over the next-highest route.`);
    }
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    results.hidden = true;
    error.textContent = failure.message;
  }
}

form.addEventListener('input', () => {
  document.getElementById('mpaa-field').hidden = !form.elements.namedItem('mpaaApplies').checked;
  update();
});
form.addEventListener('submit', event => event.preventDefault());
update();
