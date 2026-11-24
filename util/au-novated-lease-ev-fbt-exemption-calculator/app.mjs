import {calculateNovatedEV, parseCents} from './model.mjs';

const money = new Intl.NumberFormat('en-AU', {style: 'currency', currency: 'AUD', currencyDisplay: 'code'});
const currency = cents => money.format(cents / 100);

export function summarize(form) {
  const r = calculateNovatedEV({
    salary: parseCents(form.get('salary')), lctValue: parseCents(form.get('lctValue')),
    baseValue: parseCents(form.get('baseValue')), financeNet: parseCents(form.get('financeNet')),
    runningGst: parseCents(form.get('runningGst')), otherCosts: parseCents(form.get('otherCosts')),
    privateAnnualCost: parseCents(form.get('privateAnnualCost')), vehicle: form.get('vehicle'),
    conditionsMet: form.get('conditionsMet'), commitment: form.get('commitment'), medicare: form.get('medicare'),
  });
  const rfba = ['Full-year statutory RFBA estimate', r.reportable ? currency(r.rfba)
    : 'Below or at the reporting threshold for this benefit alone'];
  if (r.eligibility !== 'eligible') {
    return [
      ['FBT exemption', r.eligibility === 'ineligible'
        ? 'Outside the modelled electric-car exemption' : 'Review required before estimating exempt packaging'],
      ['2026–27 LCT value test', r.thresholdPassed ? 'At or below A$91,661' : 'Above A$91,661'],
      ['Indicative statutory RFBA before eligibility review', rfba[1]],
    ];
  }
  return [
    ['Estimated annual take-home cost of novated lease', currency(r.netAnnualCost)],
    ['Comparable after-tax annual purchase or loan budget', currency(r.privateAnnualCost)],
    ['Annual cash-flow difference · private cost minus package', currency(r.difference)],
    ['Eligible full-exemption scenario · employer FBT', currency(r.fbt)],
    rfba,
    ['Income tests affected by RFBA', 'HELP, Medicare levy surcharge, Child Care Subsidy and Division 293'],
    ['Annual pre-tax salary deduction', currency(r.sacrifice)],
    ['Salary remaining taxable', currency(r.taxableAfter)],
    ['Income tax saved, including applicable low income tax offset', currency(r.incomeTaxSavings)],
    ['Medicare levy saved under selected assumption', currency(r.levySavings)],
    ['Estimated GST credit on vehicle purchase · already reflected in the quote', currency(r.purchaseGstCredit)],
    ['Estimated GST removed from eligible running expenses', currency(r.runningGstCredit)],
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
