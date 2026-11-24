import { calculate } from './model.mjs';

const form = document.getElementById('cgt-form');
const results = document.getElementById('results');
const error = document.getElementById('error');
const notice = document.getElementById('live-status');
const cutoff = document.getElementById('cutoff-choice');
const absenceBasis = form.elements.namedItem('absenceBasis');

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol',
});
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 3 });
const integer = new Intl.NumberFormat('en-AU');

const dateFields = [
  'purchaseContract', 'ownershipStart', 'saleContract', 'saleSettlement',
  'firstRent', 'moveBack', 'rentalFirstMoveIn',
];
const amountFields = [
  'purchasePrice', 'buyingCosts', 'preRentalImprovements', 'postRentalImprovements',
  'sellingCosts', 'marketValue', 'salePrice', 'otherIncome',
];
const methodNames = {
  reset: 'Compulsory market value reset',
  original: 'Original cost base',
  exempt: 'Fully exempt',
};

function write(id, value) {
  document.getElementById(id).textContent = value;
}

function fillColumn(prefix, value) {
  const { method, costBase, rawGain, taxableDays, totalDays, taxableFraction,
    apportionedGain, discountEligible, netTaxableGain, incomeTax, medicareLevy, additionalTax } = value;
  const exempt = method === 'exempt';
  write(prefix + '-method', methodNames[method]);
  write(prefix + '-cost', exempt ? '—' : currency.format(costBase));
  write(prefix + '-raw', exempt ? '—' : currency.format(rawGain));
  write(prefix + '-days', `${integer.format(taxableDays)} / ${integer.format(totalDays)}`);
  write(prefix + '-fraction', percent.format(taxableFraction));
  write(prefix + '-gain', currency.format(apportionedGain));
  write(prefix + '-discount', exempt ? '—' : discountEligible ? '50%' : '0%');
  write(prefix + '-net', currency.format(netTaxableGain));
  write(prefix + '-income-tax', currency.format(incomeTax));
  write(prefix + '-levy', currency.format(medicareLevy));
  write(prefix + '-tax', currency.format(additionalTax));
}

function render() {
  const input = Object.fromEntries(dateFields.map(name => [name, form.elements.namedItem(name).value]));
  for (const name of amountFields) input[name] = form.elements.namedItem(name).valueAsNumber;
  input.claim6YearAbsence = form.elements.namedItem('claim6YearAbsence').value === 'yes';
  input.absenceBasis = absenceBasis.value;
  input.priorFullExemption = form.elements.namedItem('priorFullExemption').checked;
  input.afterCutoffTime = form.elements.namedItem('afterCutoffTime').checked;
  cutoff.hidden = input.firstRent !== '1996-08-20';
  absenceBasis.disabled = !input.claim6YearAbsence;

  try {
    const { homeFirst, rentedFirst, unreset, resetTaxSaved, resetClockTrap } = calculate(input);
    fillColumn('a', homeFirst);
    fillColumn('b', rentedFirst);
    write('unreset', currency.format(unreset.additionalTax));
    write('saved', currency.format(Math.round(resetTaxSaved * 100) / 100));
    write('rental-days', integer.format(homeFirst.rentedDays));
    write('exempt-days', integer.format(homeFirst.exemptRentalDays));
    document.getElementById('clock-warning').hidden = !resetClockTrap;
    document.getElementById('approximation-warning').hidden =
      !input.claim6YearAbsence || input.absenceBasis !== 'fixed2190';
    const lossCases = [homeFirst.belowCostBase && 'Scenario A', rentedFirst.belowCostBase && 'Scenario B'].filter(Boolean);
    const lossNote = document.getElementById('loss-note');
    lossNote.hidden = lossCases.length === 0;
    lossNote.textContent = lossCases.length
      ? `${lossCases.join(' and ')}: proceeds are below the modelled cost base. The estimated taxable gain is $0. A capital loss requires a separate reduced cost base calculation.`
      : '';
    error.hidden = true;
    results.hidden = false;
    notice.textContent = `Estimated additional tax. Home first ${currency.format(homeFirst.additionalTax)}. Rented first ${currency.format(rentedFirst.additionalTax)}.`;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    notice.textContent = '';
    error.textContent = issue.message;
    error.hidden = false;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
