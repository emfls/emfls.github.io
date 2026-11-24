import { compare } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const numberFields = [...form.querySelectorAll('input[type="number"]')];
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const formatMoney = value => currency.format(Math.abs(value) < 0.005 ? 0 : value);
const percent = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const formatPercent = value => `${percent.format(value)}%`;

function duration(months) {
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (remainder || !years) parts.push(`${remainder} month${remainder === 1 ? '' : 's'}`);
  return parts.join(' ');
}

function show(fields) {
  for (const [id, message] of Object.entries(fields)) {
    const element = document.getElementById(id);
    if (element.textContent !== message) element.textContent = message;
  }
}

function render(result, input) {
  const { firstYear, winners } = result;
  let alert = 'Your overpayments stay within the modelled lender allowances.';
  if (result.totalErc > 0.005) {
    alert = firstYear.erc > 0.005
      ? `Your starting lender-year plan goes over the cap by ${formatMoney(firstYear.excess)}.`
      : 'Your plan goes over a lender cap in a later year.';
  } else if (result.ercYears.some(year => year.excess > 0.005)) {
    alert = 'Your plan goes over a lender cap. The entered charge is £0.00 to the nearest penny.';
  }

  let scenarioHurdle = 'Above 100% or no match';
  if (input.lump + input.extra === 0) {
    scenarioHurdle = 'Enter a lump sum or monthly overpayment';
  } else if (result.scenarioTaxableAer === 0 && result.budget > result.mortgageWealth) {
    scenarioHurdle = '0.00% minimum';
  } else if (result.scenarioTaxableAer !== null) {
    scenarioHurdle = formatPercent(result.scenarioTaxableAer);
  }

  show({
    winner: winners.length === 1 ? `Net wealth winner: ${winners[0]}` : `Tie: ${winners.join(' and ')}`,
    horizon: `Projected cash and savings after ${duration(result.termMonths)}, with the mortgage cleared.`,
    'mortgage-wealth': formatMoney(result.mortgageWealth),
    'isa-wealth': formatMoney(result.isaWealth),
    'taxable-wealth': formatMoney(result.taxableWealth),
    'interest-saved': formatMoney(result.interestSaved),
    'term-saved': duration(result.monthsSaved),
    'payment': formatMoney(result.payment),
    'payoff': result.payoffMonths === 0 ? 'Immediately' : duration(result.payoffMonths),
    'taxable-tax': formatMoney(result.taxableTax),
    'isa-tax': formatMoney(result.isaTax),
    'psa-left': formatMoney(firstYear.availablePsa),
    'isa-room': formatMoney(firstYear.isaRoom),
    'isa-in': formatMoney(firstYear.isaContributions),
    'isa-out': formatMoney(firstYear.isaOverflow),
    'hurdle-nominal': formatPercent(result.nominalTaxableHurdle),
    'hurdle-aer': formatPercent(result.fullyTaxedAerHurdle),
    'hurdle-scenario': scenarioHurdle,
    'erc-message': alert,
    'fee-free-before': formatMoney(firstYear.allowanceBeforePlan),
    'fee-free-after': formatMoney(firstYear.allowanceRemaining),
    'erc-first': formatMoney(firstYear.erc),
    'erc-total': formatMoney(result.totalErc),
  });
}

function update() {
  const input = Object.fromEntries(numberFields.map(field => [field.id, field.valueAsNumber]));
  input.band = form.elements.band.value;
  input.regime = form.elements.regime.value;
  input.age65 = form.elements.age65.value === 'true';

  const invalid = numberFields.find(field => !field.validity.valid);
  let message = '';
  if (invalid) {
    message = `${invalid.labels[0].textContent} — ${invalid.validationMessage}`;
  } else if (input.usedCashIsa > input.usedIsa) {
    message = 'Cash ISA subscriptions must be included in the total already paid into all ISAs.';
  }

  if (!message) {
    try {
      render(compare(input), input);
    } catch (problem) {
      if (!(problem instanceof RangeError)) throw problem;
      message = problem.message;
    }
  }

  if (error.textContent !== message) error.textContent = message;
  error.hidden = !message;
  results.hidden = Boolean(message);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
