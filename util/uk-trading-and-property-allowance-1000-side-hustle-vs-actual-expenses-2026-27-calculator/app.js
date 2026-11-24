import { calculate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('tax-form');
const results = byId('results');
const preview = byId('preview');
const error = byId('input-error');
const amountFields = [...form.querySelectorAll('input[type="number"]')];
const flagFields = [...form.querySelectorAll('input[type="checkbox"]')];
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = (amount) => amount === null ? 'Unavailable' : gbp.format(amount);

const electionLabels = {
  FULL_RELIEF_NO_SA: 'Full relief',
  PARTIAL_ALLOWANCE_1000: 'Use the £1,000 allowance',
  ACTUAL_EXPENSES: 'Use actual expenses'
};
const filingLabels = {
  SA_REQUIRED: ['Self Assessment required', 'The entered figures or your filing selection indicate a return is required.'],
  CONTACT_HMRC: ['Contact HMRC about rental income', 'Gross rent exceeds £1,000. Ask HMRC how to report it.'],
  SA_IF_CLAIMING_LOSS: ['File to claim trading loss relief', 'If you opt out of full relief to claim a trading loss, report it through Self Assessment.'],
  CHECK_HMRC: ['Check your filing position with HMRC', 'An ineligible allowance or a property loss can affect how you report this income.'],
  NO_SA_FOR_ENTERED_INCOME: ['No Self Assessment indicated for these receipts', 'Keep your income records. Other filing obligations may still apply.']
};

function show(id, value) {
  byId(id).textContent = value;
}

function renderStream(prefix, stream, input) {
  const hasActivity = input[`${prefix}Gross`] > 0 || input[`${prefix}Expenses`] > 0;
  const election = byId(`${prefix}-election`);
  election.textContent = hasActivity ? electionLabels[stream.election] : 'No receipts or expenses';
  election.dataset.election = hasActivity ? stream.election : '';
  show(`${prefix}-allowance`, money(stream.allowanceProfit));
  show(`${prefix}-actual`, money(stream.actualProfit));
}

function renderPreview({ trading, optimal, preview: future }) {
  show('current-trading-profit', money(trading.selectedProfit));
  show('next-trading-profit', money(future.trading.selectedProfit));
  show('current-income-tax', money(optimal.incomeTax));
  show('next-income-tax', money(future.bill.incomeTax));
  show('current-class4', money(optimal.class4));
  show('next-class4', money(future.bill.class4));
  show('current-total', money(optimal.total));
  show('next-total', money(future.bill.total));
  show('preview-savings', money(future.savings));
  show('preview-breakdown', `${money(future.incomeTaxSavings)} Income Tax and ${money(future.class4Savings)} Class 4 NIC saved.`);
}

function render(result, input) {
  const [badge, description] = filingLabels[result.filing];
  show('filing', badge);
  byId('filing').dataset.filing = result.filing;
  const rentalContact = result.rentalFiling === 'CONTACT_HMRC' &&
    result.filing !== 'CONTACT_HMRC' && result.filing !== 'SA_REQUIRED';
  show('filing-detail', rentalContact ? `${description} ${filingLabels.CONTACT_HMRC[1]}` : description);
  renderStream('trading', result.trading, input);
  renderStream('property', result.property, input);

  const losses = [
    ['Trading', result.trading.loss],
    ['Property', result.property.loss]
  ].filter(([, amount]) => amount > 0);
  const lossDetail = byId('loss-detail');
  lossDetail.hidden = losses.length === 0;
  lossDetail.textContent = losses.map(([name, amount]) => `${name} loss under actual expenses: ${money(amount)}.`).join(' ');

  const bills = {
    optimal: result.optimal,
    allowances: result.allAllowance,
    expenses: result.allExpenses
  };
  for (const [method, bill] of Object.entries(bills)) {
    for (const line of ['incomeTax', 'class4', 'total']) {
      show(`${method}-${line}`, money(bill?.[line] ?? null));
    }
  }
  show('savings-expenses', money(result.savingsVsExpenses));
  show('savings-allowances', money(result.savingsVsAllowance));
  show('extra-tax', money(result.optimal.extraTaxAndNIC));
  renderPreview(result);
}

function update() {
  const invalid = amountFields.find((field) => !field.validity.valid);
  for (const field of amountFields) {
    field.setAttribute('aria-invalid', String(!field.validity.valid));
  }
  results.hidden = Boolean(invalid);
  preview.hidden = Boolean(invalid);
  error.hidden = !invalid;
  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = `Enter ${label.toLowerCase()} from £0 to £10,000,000 with up to two decimal places.`;
    return;
  }

  const input = Object.fromEntries(amountFields.map((field) => [field.id, field.valueAsNumber]));
  for (const field of flagFields) input[field.id] = field.checked;
  let result;
  try {
    result = calculate(input);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = preview.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }
  render(result, input);
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('reset', () => setTimeout(update, 0));
update();
