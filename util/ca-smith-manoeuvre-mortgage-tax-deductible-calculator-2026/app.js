import { compareScenarios } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const fields = form.elements;
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percentage = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 4 });
const money = (amount) => currency.format(Math.abs(amount) < .5 ? 0 : amount);
const write = (id, value) => { byId(id).textContent = value; };

function duration(totalMonths) {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (!years) return `${months} ${months === 1 ? 'month' : 'months'}`;
  if (!months) return `${years} ${years === 1 ? 'year' : 'years'}`;
  return `${years} ${years === 1 ? 'year' : 'years'}, ${months} ${months === 1 ? 'month' : 'months'}`;
}

function showAmount(id, value) {
  write(id, money(value));
  byId(id).classList.toggle('loss', value <= -.5);
}

function render(base, higherHeloc, lowerReturn, input) {
  const startingLtv = `Starting LTV is ${percentage.format(base.startingLtv)}.`;
  const gate = base.gateMonth === 0
    ? 'The mortgage is already at or below 65% LTV.'
    : `Reaching 65% LTV requires ${cents.format(base.gatePaydown)} of principal paydown. The scheduled mortgage reaches it in month ${base.gateMonth} (${duration(base.gateMonth)}).`;
  const draw = base.firstDrawMonth === null ? 'No HELOC investment draw occurs.' : `The first investment draw occurs in month ${base.firstDrawMonth}.`;
  write('gate', `${startingLtv} ${gate} ${draw}`);
  write('payment', `Scheduled mortgage payment ${cents.format(base.payment)} per month · Estimated combined marginal rate ${percentage.format(base.rates.combined)}`);
  write('time-saved', duration(base.monthsSaved));
  write('refund', money(base.totalRefund));
  showAmount('advantage', base.netAdvantage);
  write('risk-result', `Household cash pays ${money(base.cashHelocInterest)} of HELOC interest in the base case and ${money(higherHeloc.cashHelocInterest)} if the rate rises by 2 percentage points.`);
  write('rate-case', `HELOC rate +2 percentage points (${percentage.format(input.helocRate + .02)})`);
  write('return-case', `Portfolio return −2 percentage points (${percentage.format(input.expectedReturn - .02)})`);
  showAmount('stress-base', base.netAdvantage);
  showAmount('stress-rate', higherHeloc.netAdvantage);
  showAmount('stress-return', lowerReturn.netAdvantage);
  showAmount('stress-rate-delta', higherHeloc.netAdvantage - base.netAdvantage);
  showAmount('stress-return-delta', lowerReturn.netAdvantage - base.netAdvantage);

  const breakdown = document.createDocumentFragment();
  for (const [label, value] of [
    ['Smith mortgage payoff', duration(base.payoffMonth)],
    ['Traditional mortgage payoff', duration(base.traditionalPayoffMonth)],
    ['Tax savings applied as mortgage prepayments', money(base.refundPrepayments)],
    ['Interest financed through the HELOC', money(base.capitalizedInterest)],
    ['HELOC interest eligible for the federal estimate', money(base.deductibleInterest)],
    ['Portfolio before sale tax', money(base.portfolio)],
    ['Adjusted cost basis', money(base.costBasis)],
    ['Estimated capital gains tax', money(base.capitalGainsTax)],
    ['HELOC balance to repay', money(base.endingHeloc)],
    ['Smith mortgage balance', money(base.endingMortgage)],
    ['Traditional mortgage balance', money(base.endingTraditionalMortgage)],
    ['Cumulative cash retained vs. traditional', money(base.cashDifference)],
  ]) {
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = label;
    definition.textContent = value;
    breakdown.append(term, definition);
  }
  byId('breakdown').replaceChildren(breakdown);

  const timeline = document.createDocumentFragment();
  for (const row of base.rows) {
    if (row.month % 12 !== 0 && row.month !== input.months) continue;
    const line = document.createElement('tr');
    const month = document.createElement('th');
    month.scope = 'row';
    month.textContent = row.month;
    line.append(month);
    for (const amount of [row.mortgage, row.traditional, row.heloc, row.portfolio, row.refund]) {
      const cell = document.createElement('td');
      cell.textContent = money(amount);
      line.append(cell);
    }
    timeline.append(line);
  }
  byId('timeline').replaceChildren(timeline);
}

function update() {
  const custom = fields.province.value === 'custom';
  byId('income-field').hidden = fields.taxableIncome.disabled = custom;
  byId('custom-field').hidden = fields.customRate.disabled = !custom;
  byId('quebec-note').hidden = fields.province.value !== 'QC';
  const error = byId('error');
  const results = byId('results');
  const numbers = Array.from(form.querySelectorAll('input[type="number"]:enabled'));
  for (const field of numbers) field.setAttribute('aria-invalid', String(!field.validity.valid));
  try {
    const invalid = numbers.find((field) => !field.validity.valid);
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    const input = {
      homeValue: fields.homeValue.valueAsNumber,
      mortgageBalance: fields.mortgageBalance.valueAsNumber,
      months: fields.months.valueAsNumber,
      mortgageRate: fields.mortgageRate.valueAsNumber / 100,
      helocRate: fields.helocRate.valueAsNumber / 100,
      expectedReturn: fields.expectedReturn.valueAsNumber / 100,
      dividendYield: fields.dividendYield.valueAsNumber / 100,
      province: fields.province.value,
      taxableIncome: fields.taxableIncome.valueAsNumber,
      customRate: fields.customRate.valueAsNumber / 100,
      capitalize: fields.capitalize.checked,
    };
    if (input.mortgageBalance > input.homeValue * .8 + 1e-7) fields.mortgageBalance.setAttribute('aria-invalid', 'true');
    const { base, higherHeloc, lowerReturn } = compareScenarios(input);
    render(base, higherHeloc, lowerReturn, input);
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    error.textContent = failure.message;
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

// Initialize only publisher-confirmed ad unit IDs.
for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d{10}$/.test(slot.dataset.adSlot)) (window.adsbygoogle ??= []).push({});
}
