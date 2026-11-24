import { calculateVat } from './model.mjs';

const byId = (id) => document.getElementById(id);
const number = (id) => byId(id).valueAsNumber;
const optionalNumber = (id) => byId(id).value === '' ? undefined : number(id);
const write = (id, text) => { byId(id).textContent = text; };
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const form = byId('vat-calculator');
const results = byId('results');
const error = byId('input-error');

function showComparison(result, firstYear) {
  const savings = money.format(result.annualSavings);
  const winner = result.winner === 'FLAT_RATE' ? 'Flat Rate Scheme' : 'Standard VAT';
  const difference = result.winner === 'TIE' ? 'Both methods leave the same annual cash.' :
    winner + ' leaves ' + savings + ' more cash per year.';
  const exceedsExit = result.anniversaryExitThresholdExceeded;
  write('winner', exceedsExit ? 'Illustrative comparison. The anniversary exit threshold is exceeded. ' + difference : difference);
  write('flat-vat', money.format(result.flatRateVatPayable));
  write('standard-vat', money.format(result.standardVatPayable));
  write('flat-capital', money.format(result.flatCapitalVat));
  write('standard-capital', money.format(result.standardCapitalVat));
  write('flat-cash', money.format(result.flatRateNetCash));
  write('standard-cash', money.format(result.standardNetCash));

  const category = result.status === 'LIMITED_COST_16_5_PCT' ? 'Limited cost trader' : 'Sector rate applies';
  write('flat-rate', category + ' · ' + result.effectiveFlatRate + '%' +
    (firstYear ? ' with the first-year discount' : ''));
  byId('flat-rate').dataset.status = result.status;
  write('gross-sales', money.format(result.grossTurnoverIncVat));
  const target = money.format(result.relevantGoodsTarget);
  const shortfall = money.format(result.additionalRelevantGoodsNeeded);
  write('target', result.additionalRelevantGoodsNeeded > 0 ?
    target + ' total including VAT (' + shortfall + ' more needed).' :
    target + ' total including VAT. You already meet the threshold.');

  const breakEven = result.breakEvenOperatingExpensesNet;
  write('break-even', breakEven === null ?
    'Standard VAT leaves more cash even with zero operating expenses at this flat rate and capital spend.' :
    money.format(breakEven) + ' excluding VAT at the current flat rate and capital spend.');

  write('registration', result.registrationThresholdExceeded ?
    'Rolling 12-month taxable turnover exceeds the £90,000 registration threshold.' :
    'Rolling 12-month taxable turnover is within the £90,000 threshold.');
  write('entry', result.withinEntryTurnoverLimit ?
    'Projected taxable turnover is within the £150,000 FRS entry cap.' :
    'Projected taxable turnover exceeds the £150,000 FRS entry cap for new applicants.');
  write('exit', exceedsExit ?
    'Anniversary income exceeds £230,000. The exit rule applies unless HMRC allows an exception.' :
    'Anniversary income is within the £230,000 FRS exit threshold.');
}

function update() {
  const custom = byId('sector').value === 'custom';
  byId('custom-field').hidden = !custom;
  byId('custom').disabled = !custom;
  try {
    if (!form.checkValidity()) throw new RangeError('Enter amounts within the stated limits, with up to two decimal places.');
    const firstYear = byId('first-year').checked;
    const result = calculateVat({
      netTaxableSales: number('sales'),
      vatableExpensesNet: number('expenses'),
      relevantGoodsGross: number('goods'),
      singleCapitalPurchaseGross: number('capital'),
      otherCapitalNet: number('other-capital'),
      sectorRate: custom ? number('custom') : Number(byId('sector').value),
      firstYear,
      rollingTaxableTurnover: optionalNumber('rolling'),
      projectedTaxableTurnover: optionalNumber('projected'),
      anniversaryTotalIncome: optionalNumber('anniversary'),
    });
    showComparison(result, firstYear);
    results.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
update();
