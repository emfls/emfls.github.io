import { calculateSavings } from './model.mjs';

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percentage = new Intl.NumberFormat('en-GB', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 6,
});
const byId = id => document.getElementById(id);
const setText = (id, text) => { byId(id).textContent = text; };
const formatMoney = amount => money.format(Math.abs(amount) < 0.005 ? 0 : amount);
const formatAer = value => value === null ? '—' : percentage.format(value / 100);
const form = byId('savings-form');
const results = byId('calculator-results');
const error = byId('input-error');
const inputs = {
  nonSavingsIncome: byId('income'),
  balance: byId('balance'),
  aer: byId('aer'),
  otherInterest: byId('other-interest'),
  isaRoom: byId('isa-room'),
};

function renderComparison(result) {
  const { taxableAccount: ordinary, cashIsa: isa } = result;
  const balanceLimit = result.taxFreeBalance === null ? 'No limit at 0% AER' : formatMoney(result.taxFreeBalance);

  setText('tax-free-balance', balanceLimit);
  setText('personal-savings-allowance', formatMoney(ordinary.psa));
  setText('allowance-summary',
    `${ordinary.band}-rate band with the ordinary account. Personal Allowance: ${formatMoney(ordinary.personalAllowance)}. Of your savings interest, ${formatMoney(ordinary.zeroRated.personalAllowance)} uses Personal Allowance, ${formatMoney(ordinary.zeroRated.startingRate)} uses the starting rate and ${formatMoney(ordinary.zeroRated.psa)} uses the PSA.`);
  setText('isa-allocation',
    `${formatMoney(isa.deposit)} in the ISA earns ${formatMoney(isa.isaInterest)} tax-free. ${formatMoney(isa.outsideBalance)} stays in ordinary savings. Your PSA in this scenario is ${formatMoney(isa.psa)}.`);

  for (const year of ['2026', '2027']) {
    const ordinaryYear = ordinary[`y${year}`];
    const isaYear = isa[`y${year}`];
    setText(`ordinary-${year}-gross`, formatMoney(ordinary.grossInterest));
    setText(`ordinary-${year}-tax`, formatMoney(ordinaryYear.tax));
    setText(`ordinary-${year}-account-tax`, formatMoney(ordinaryYear.accountTax));
    setText(`ordinary-${year}-net`, formatMoney(ordinaryYear.netInterest));
    setText(`ordinary-${year}-aer`, formatAer(ordinaryYear.netAer));
    setText(`isa-${year}-tax`, formatMoney(isaYear.tax));
    setText(`isa-${year}-saved`, formatMoney(isaYear.taxSaved));
    setText(`isa-${year}-net`, formatMoney(isaYear.netInterest));
    setText(`isa-${year}-aer`, formatAer(isaYear.netAer));
  }

  const increase = ordinary.y2027.tax - ordinary.y2026.tax;
  setText('rate-impact', increase > 0
    ? `The April 2027 proposal adds ${formatMoney(increase)} to your annual savings tax in the ordinary account scenario.`
    : 'The April 2027 proposal adds no savings tax at these figures.');
  setText('results-announcement', `Tax-free savings balance: ${balanceLimit}. 2026/27 ordinary savings tax: ${formatMoney(ordinary.y2026.tax)}. April 2027 proposed savings tax: ${formatMoney(ordinary.y2027.tax)}.`);
}

function update() {
  for (const input of Object.values(inputs)) {
    if (!input.validity.valid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  let calculation;
  try {
    calculation = calculateSavings(Object.fromEntries(
      Object.entries(inputs).map(([key, input]) => [key, input.valueAsNumber]),
    ));
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    setText('results-announcement', '');
    return;
  }

  error.hidden = true;
  error.textContent = '';
  renderComparison(calculation);
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
