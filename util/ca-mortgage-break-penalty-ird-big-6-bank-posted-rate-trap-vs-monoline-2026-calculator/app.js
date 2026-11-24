import { calculateMortgageBreak } from './model.mjs';

const form = document.getElementById('mortgage-calculator');
const fixedTerms = document.getElementById('fixed-terms');
const rateLabel = document.getElementById('contract-rate-label');
const results = document.getElementById('calc-results');
const status = document.getElementById('calc-status');
const scenarios = document.getElementById('refinance-scenarios');
const template = document.getElementById('scenario-template');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const decimal = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 3 });
const verdicts = {
  refinance: 'REFINANCE NOW (NET GAIN)',
  wait: 'WAIT FOR RENEWAL (NET LOSS)',
  break_even: 'BREAK EVEN',
};
const scenarioCards = [
  ['bank', 'Big Six · no lump sum'],
  ['bankAfterPrepayment', 'Big Six · after lump sum'],
  ['monoline', 'Monoline · no lump sum'],
  ['monolineAfterPrepayment', 'Monoline · after lump sum'],
].map(([key, title]) => {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector('h4').textContent = title;
  scenarios.append(card);
  return { key, card, verdict: card.querySelector('.verdict'), values: card.querySelectorAll('[data-result]') };
});

function update() {
  const mortgageType = form.elements.mortgageType.value;
  const isVariable = mortgageType === 'variable_closed';
  fixedTerms.hidden = fixedTerms.disabled = isVariable;
  rateLabel.textContent = isVariable ? 'Current contract rate (%)' : 'Original contract rate (%)';

  const invalid = form.querySelector('input:invalid');
  if (invalid) {
    results.hidden = true;
    status.textContent = invalid.labels[0].textContent + ' — ' + invalid.validationMessage;
    return;
  }

  const inputs = { mortgageType };
  for (const input of form.querySelectorAll('input')) {
    inputs[input.name] = input.valueAsNumber;
  }
  if (form.elements.prepaymentPercent.value === '') inputs.prepaymentPercent = 0;
  const result = calculateMortgageBreak(inputs);

  document.getElementById('bank-penalty').textContent = money.format(result.big6FinalPenalty);
  document.getElementById('monoline-penalty').textContent = money.format(result.monolineFinalPenalty);
  const multiple = result.penaltyMultiple === null ? ' — ratio unavailable' : ' · ' + decimal.format(result.penaltyMultiple) + '×';
  document.getElementById('extra-cost').textContent = money.format(result.extraCost) + multiple;
  document.getElementById('three-month-interest').textContent = money.format(result.threeMonthsInterest);
  document.getElementById('ird-detail').textContent = isVariable
    ? 'Both variable-rate estimates use three months’ interest.'
    : 'Original discount: ' + decimal.format(result.originalDiscount) + ' percentage points. Bank comparison rate: '
      + decimal.format(result.bankComparisonRate) + '%. Before the floor, bank IRD is '
      + money.format(result.bankIrdPenalty) + ' and monoline IRD is ' + money.format(result.monolineIrdPenalty) + '.';
  document.getElementById('prepayment-detail').textContent =
    'Paying ' + money.format(result.lumpSum) + ' first leaves ' + money.format(result.reducedBalance)
    + ' and cuts the modeled penalty by ' + money.format(result.bankPenaltySavings)
    + ' (Big Six) or ' + money.format(result.monolinePenaltySavings) + ' (monoline).';
  for (const { key, card, verdict, values } of scenarioCards) {
    const scenario = result[key];
    card.hidden = key.endsWith('AfterPrepayment') && result.lumpSum === 0;
    verdict.textContent = verdicts[scenario.verdict];
    const formatted = {
      net: money.format(scenario.verdict === 'break_even' ? 0 : scenario.net),
      interestSaved: money.format(scenario.interestSaved),
      switchingCost: money.format(scenario.switchingCost),
      breakEvenRate: scenario.breakEvenRate < 0 ? 'No non-negative rate' : decimal.format(scenario.breakEvenRate) + '%',
      breakEvenMonths: scenario.breakEvenMonths === null
        ? (scenario.switchingCost === 0 && scenario.interestSaved === 0 ? '0' : 'Not reached')
        : decimal.format(scenario.breakEvenMonths),
    };
    for (const value of values) value.textContent = formatted[value.dataset.result];
  }
  const bank = result.bank;
  status.textContent = 'Big Six before lump sum — ' + verdicts[bank.verdict] + '.';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', event => event.preventDefault());
update();
