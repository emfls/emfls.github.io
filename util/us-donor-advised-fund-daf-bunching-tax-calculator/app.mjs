import {compareGiving, parseCents} from './model.mjs';

const usd = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});
const currency = cents => usd.format(cents / 100);

export function summarize(form) {
  const cents = name => parseCents(form.get(name));
  const years = Number(form.get('years'));
  const r = compareGiving({
    status:form.get('status'), agi:cents('agi'), annualGift:cents('annualGift'), other:cents('other'),
    years, rate:Number(form.get('rate')), annualType:form.get('annualType'), bunchType:form.get('bunchType'),
    stockBasis:form.has('stockBasis') ? cents('stockBasis') : 0,
    gainRate:Number(form.get('gainRate') ?? 0), niit:form.has('niit'),
  });
  const method = data => data.itemizes ? 'Itemize' : 'Standard deduction';
  const carryover = data => currency(data.excess) +
    (data.excess ? ' · above ceiling. Potential five-year carryforward, subject to limitations.' : '');
  return {rows:[
    ['Estimated ' + years + '-year net tax advantage of bunching', currency(r.netAdvantage)],
    ['Annual giving · total federal deduction benefit', currency(r.annualSavings)],
    ['DAF bunching · total federal deduction benefit', currency(r.bunchSavings)],
    ['Difference from deductions alone', currency(r.deductionAdvantage)],
    ['Estimated optional stock sale tax avoided', currency(r.gainTaxAvoided)],
    ['2026 basic standard deduction', currency(r.standard)],
    ['Modeled itemized benefit rate', r.effectiveRate + '%'],
    ['Potential Schedule A AGI floor per year with gifts', currency(r.annual.floor)],
    ['Annual giving · method each year', method(r.annual)],
    ['Annual giving · direct cash deduction if using standard deduction', currency(r.annual.itemizes ? 0 : r.annual.cashDeduction)],
    ['Annual giving · potential Schedule A charity each year', currency(r.annual.deduction)],
    ['Annual giving · ceiling excess per year', carryover(r.annual)],
    ['Bunching · year 1 gift and method', currency(r.bunch.gift) + ' · ' + method(r.bunch)],
    ['Bunching · year 1 potential Schedule A charity', currency(r.bunch.deduction)],
    ['Bunching · year 1 ceiling excess', carryover(r.bunch)],
    ['Bunching · years 2–' + years + ' method', method(r.later)],
  ]};
}

function updateFields(form) {
  const stock = form.querySelector('#stock-sale');
  const show = form.elements.bunchType.value === 'stock' && form.elements.annualType.value !== 'stock';
  stock.hidden = !show;
  stock.disabled = !show;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const hint = result.textContent.trim();
  updateFields(form);
  form.addEventListener('input', () => {
    updateFields(form);
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
