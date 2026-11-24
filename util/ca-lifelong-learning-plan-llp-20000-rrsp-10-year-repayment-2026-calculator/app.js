import { calculateLLP, firstRepaymentYear, nonDeductibleContribution, REPAYMENT_YEARS } from './model.mjs';

const get = (id) => document.getElementById(id);
const write = (id, value) => { get(id).textContent = value; };
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const monthFormat = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const cad = (value) => currency.format(value);
const form = get('llp-form');
const scenarioError = get('scenario-error');
const results = get('results');
const deductionForm = get('deduction-form');
const deductionResult = get('deduction-result');
const savedPayments = new Map();
let paymentStart;

function setMessage(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function number(id) {
  const input = get(id);
  const value = input.valueAsNumber;
  if (!input.validity.valid || !Number.isFinite(value)) {
    throw new RangeError(`Enter a valid value for ${input.labels[0].textContent.trim()}.`);
  }
  return value;
}

function makeRow() {
  const row = document.createElement('tr');
  const year = document.createElement('th');
  year.scope = 'row';
  row.append(year);
  return row;
}

const paymentRows = Array.from({ length: REPAYMENT_YEARS }, () => {
  const row = makeRow();
  for (let column = 1; column < 8; column += 1) row.insertCell();
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.min = '0';
  input.max = '1000000';
  input.step = '0.01';
  input.placeholder = 'Minimum';
  input.setAttribute('aria-describedby', 'repayment-help');
  row.cells[3].append(input);
  get('repayment-rows').append(row);
  return { row, input };
});

function renderDraws(withdrawals) {
  get('draw-rows').replaceChildren(...withdrawals.map((draw, index) => {
    const row = makeRow();
    row.cells[0].textContent = index === 4 ? `Jan. ${draw.year}` : draw.year;
    for (const key of ['requested', 'eligible', 'taxable', 'taxableTax', 'directWithholding']) {
      row.insertCell().textContent = cad(draw[key]);
    }
    return row;
  }));
}

function renderSchedule(schedule) {
  get('schedule').hidden = schedule.length === 0;
  schedule.forEach((payment, index) => {
    const { row, input } = paymentRows[index];
    row.cells[0].textContent = payment.year;
    row.cells[1].textContent = cad(payment.opening);
    row.cells[2].textContent = cad(payment.minimum);
    input.setAttribute('aria-label', `${payment.year} designated repayment in Canadian dollars`);
    row.cells[4].textContent = cad(payment.designated);
    row.cells[5].textContent = cad(payment.income);
    row.cells[6].textContent = cad(payment.tax);
    row.cells[7].textContent = cad(payment.closing);
  });
}

function renderComparison(result) {
  const { netLLP, comparisonReason, lostGrowth, rrspPrincipalMissing, horizonYear, horizonMonth, loanPayment, loanTotal } = result;
  if (comparisonReason === 'none') {
    write('verdict', 'Enter an eligible LLP withdrawal to compare matched funding.');
    write('comparison-detail', '');
    return;
  }

  const date = monthFormat.format(new Date(Date.UTC(horizonYear, horizonMonth - 1)));
  const growth = lostGrowth < -0.005
    ? `${cad(-lostGrowth)} in projected RRSP investment losses avoided by drawing the funds.`
    : `${cad(Math.max(0, lostGrowth))} in projected RRSP growth forgone before retirement tax.`;
  const principal = `${cad(rrspPrincipalMissing)} in principal left unrestored after income inclusions.`;
  if (comparisonReason === 'timing') {
    write('verdict', 'Set the first loan payment month at or after the last eligible January withdrawal to compare net wealth.');
    write('comparison-detail', `By ${date}: ${growth} ${principal}`);
    return;
  }

  let verdict = 'Both options yield the same estimated after-tax net wealth';
  if (netLLP > 0) verdict = `The LLP leaves ${cad(netLLP)} more in estimated after-tax net wealth`;
  if (netLLP < 0) verdict = `The federal loan leaves ${cad(-netLLP)} more in estimated after-tax net wealth`;
  write('verdict', `${verdict} by ${date}.`);
  write('comparison-detail', `Matched loan principal: ${cad(loanTotal)}. Estimated monthly loan payment: ${cad(loanPayment)}. ${growth} ${principal}`);
}

function alignPaymentYears(start) {
  if (paymentStart === start) return;
  if (paymentStart !== undefined) {
    paymentRows.forEach(({ input }, index) => savedPayments.set(paymentStart + index, input.value));
  }
  paymentRows.forEach(({ input }, index) => { input.value = savedPayments.get(start + index) ?? ''; });
  paymentStart = start;
}

function renderScenario() {
  try {
    const qualifyingYears = Array.from({ length: 4 }, (_, index) => get(`study-${index}`).checked);
    alignPaymentYears(firstRepaymentYear(qualifyingYears));
    const invalidPayments = [];
    const payments = paymentRows.map(({ input }, index) => {
      if (input.validity.valid) {
        input.removeAttribute('aria-invalid');
        return Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
      }
      input.setAttribute('aria-invalid', 'true');
      invalidPayments.push(index);
      return null;
    });
    const result = calculateLLP({
      requested: Array.from({ length: 5 }, (_, index) => number(`draw-${index}`)),
      qualifyingYears,
      eligible: get('eligible').checked,
      payments,
      taxRate: number('tax'),
      retirementRate: number('retirement-tax'),
      rrspReturn: number('rrsp-return'),
      cashReturn: number('cash-return'),
      loanFirstMonth: number('loan-start'),
      loanTerm: number('loan-term'),
    });

    const start = result.schedule[0]?.year;
    const invalidYears = invalidPayments.map(index => result.schedule[index]?.year).filter(Boolean);
    setMessage(scenarioError, invalidYears.length
      ? `Enter a valid repayment for ${invalidYears.join(', ')}. The estimate uses the minimum for those years.`
      : '');
    write('eligible-total', cad(result.eligibleTotal));
    write('tax-avoided', cad(result.withdrawals[0].taxAvoided));
    write('repayment-start', start ?? '—');
    write('shortfall-tax', cad(result.totalShortfallTax));
    write('withdrawal-summary', `${cad(result.taxableTotal)} would be taxable if the full requested amounts were withdrawn, with ${cad(result.taxableTax)} in estimated tax. Across all draws, eligible LLP treatment avoids ${cad(result.taxAvoided)} in estimated tax at withdrawal. Estimated withholding avoided is ${cad(result.withholdingAvoided)} if the issuer processes all taxable portions as ordinary withdrawals outside Quebec.`);
    renderDraws(result.withdrawals);
    renderSchedule(result.schedule);
    write('live-summary', `${cad(result.eligibleTotal)} eligible. ${start ? `Repayments begin in ${start}. ${cad(result.totalShortfallTax)} estimated tax on shortfalls.` : 'No LLP repayment schedule.'}`);
    const loss = result.totalIncome > 0
      ? `Your scenario leaves ${cad(result.totalIncome)} out of the RRSP and adds that amount to taxable income, costing an estimated ${cad(result.totalShortfallTax)} in tax.`
      : 'A $1,000 shortfall at a 30% marginal rate costs $300 in income tax and leaves $1,000 out of the RRSP.';
    write('loss-message', `${loss} A shortfall creates no new contribution room to replace those savings.`);
    renderComparison(result);
    results.hidden = false;
  } catch (error) {
    results.hidden = true;
    setMessage(scenarioError, error.message);
  }
}

function renderDeduction() {
  try {
    const risk = nonDeductibleContribution(number('recent'), number('remaining'));
    setMessage(deductionResult, `Estimated non-deductible contribution: ${cad(risk)}.`);
  } catch (error) {
    setMessage(deductionResult, error.message);
  }
}

for (const calculatorForm of [form, deductionForm]) {
  calculatorForm.addEventListener('submit', event => event.preventDefault());
}
form.addEventListener('input', renderScenario);
deductionForm.addEventListener('input', renderDeduction);
renderScenario();
renderDeduction();
