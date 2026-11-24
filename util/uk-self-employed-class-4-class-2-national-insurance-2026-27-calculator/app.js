import { calculate, RATES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const profit = byId('profit');
const source = byId('source');
const prior = byId('prior');
const voluntary = byId('voluntary');
const results = byId('estimate');
const error = byId('error');
const creditRow = byId('credit-row');
const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = amount => formatter.format(amount);

const outputs = {
  bill: 'totalBill',
  'take-home': 'takeHome',
  january: 'januaryDue',
  july: 'julyDue',
  allowance: 'personalAllowance',
  'income-tax': 'incomeTax',
  'class-4': 'class4',
  'class-2': 'class2',
  balance: 'balance',
  'first-payment': 'firstPayment',
  credit: 'estimatedCredit',
};

const pensionMessages = {
  'treated-as-paid': 'Class 2 is treated as paid at £0. This counts towards your National Insurance record.',
  voluntary: 'This estimate includes £189.80 for 52 weeks of voluntary Class 2. Check your National Insurance record to confirm you are eligible and that the weeks would fill a gap.',
  eligible: 'Your profit is below £7,105. If you qualify and need to fill a gap, you can include voluntary Class 2 in this estimate.',
};

function readAmount(input, name) {
  const { badInput, rangeUnderflow, rangeOverflow, stepMismatch, valueMissing } = input.validity;
  if (badInput || rangeUnderflow || rangeOverflow || stepMismatch || valueMissing) {
    input.setAttribute('aria-invalid', 'true');
    throw new RangeError(`Enter a valid ${name} in pounds and pence.`);
  }
  return input.value === '' ? 0 : input.valueAsNumber;
}

function update() {
  for (const input of [profit, source, prior]) input.removeAttribute('aria-invalid');

  let estimate;
  try {
    const annualProfit = readAmount(profit, 'annual profit');
    voluntary.disabled = annualProfit >= RATES.smallProfitsThreshold;
    estimate = calculate({
      profit: annualProfit,
      taxAtSource: readAmount(source, 'tax deducted at source'),
      priorPayments: readAmount(prior, 'amount already paid on account'),
      voluntaryClass2: voluntary.checked && !voluntary.disabled,
    });
  } catch (invalidAmount) {
    if (!(invalidAmount instanceof RangeError)) throw invalidAmount;
    if (profit.getAttribute('aria-invalid') === 'true') voluntary.disabled = true;
    results.hidden = true;
    error.textContent = invalidAmount.message;
    error.hidden = false;
    return;
  }

  for (const [id, key] of Object.entries(outputs)) byId(id).textContent = money(estimate[key]);
  creditRow.hidden = estimate.estimatedCredit === 0;
  byId('pension-status').textContent = pensionMessages[estimate.class2Status];
  byId('cash-warning').textContent = estimate.firstPayment > 0
    ? `Budgeting only for your 2026/27 balance leaves out the ${money(estimate.firstPayment)} January advance. With no prior payments or source deductions, that advance can bring the January bill to 150% of the current year's tax and NI.`
    : 'This estimate has no payments on account. Set aside any remaining 2026/27 balance by 31 January 2028.';
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
