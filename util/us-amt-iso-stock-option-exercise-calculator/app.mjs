import {calculateISO, minimumTaxCredit, parseCents} from './model.mjs';

const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
const currency = cents => money.format(cents / 100);
const formatShares = shares => new Intl.NumberFormat('en-US').format(shares);

export function summarize(form) {
  const r = calculateISO({
    income: parseCents(form.get('income')), status: form.get('status'),
    otherAddbacks: parseCents(form.get('otherAddbacks')),
    fmv: parseCents(form.get('fmv')), strike: parseCents(form.get('strike')),
    shares: Number(form.get('shares')), availableShares: Number(form.get('availableShares')),
  });
  const credit = minimumTaxCredit({
    creditAvailable: r.potentialMtc, futureRegularTax: parseCents(form.get('futureRegular')),
    futureTmt: parseCents(form.get('futureTmt')),
  });
  return [
    ['Estimated AMT at proposed exercise', currency(r.amt)],
    ['Maximum AMT-free whole shares within this grant', r.crossover === null
      ? 'None · baseline AMT already applies' : formatShares(r.crossover)],
    ['AMT with one share above crossover', r.nextShareAmt === null
      ? 'Out of range or no AMT-free exercise' : currency(r.nextShareAmt)],
    ['ISO bargain element', currency(r.bargain)],
    ['Regular federal income tax', currency(r.regular)],
    ['Alternative minimum taxable income', currency(r.amti)],
    ['Available AMT exemption', currency(r.exemption)],
    ['Tentative minimum tax', currency(r.tmt)],
    ['AMT without the exercise', currency(r.amtWithoutExercise)],
    ['Additional AMT due to the exercise', currency(r.incrementalAmt)],
    ['Potential ISO-related Form 8801 credit generated', currency(r.potentialMtc)],
    ['Projected credit usable next year', currency(credit.usable)],
    ['Projected credit carried forward after next year', currency(credit.carryforward)],
  ];
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
