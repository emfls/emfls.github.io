import { calculate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('lrba-form');
const fixedFields = byId('fixed-fields');
const error = byId('input-error');
const estimateContent = byId('estimate-content');
const estimateStatus = byId('estimate-status');
const failedList = byId('failed-gates');
const amount = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code'
});
const decimal = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 4 });

const numericFields = [
  'propertyValue', 'originalLoan', 'balance', 'remainingYears', 'elapsedYears',
  'actualRate', 'rentalIncome', 'capitalGain', 'fixedMonths'
];
const choiceFields = ['repayment', 'property', 'phase', 'rateType', 'fixedStart', 'assessmentDate'];
const checkboxFields = ['registeredMortgage', 'executedAgreement', 'discountEligible', 'fixedAtCommencement'];

function readInputs() {
  const input = {};
  for (const id of numericFields) input[id] = byId(id).valueAsNumber;
  for (const id of choiceFields) input[id] = byId(id).value;
  for (const id of checkboxFields) input[id] = byId(id).checked;
  return input;
}

function renderEstimate() {
  const input = readInputs();
  fixedFields.hidden = input.rateType !== 'fixed';
  let result;
  try {
    result = calculate(input);
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    error.hidden = false;
    estimateContent.hidden = true;
    estimateStatus.hidden = false;
    estimateStatus.textContent = 'Complete the loan and tax inputs to see an estimate.';
    return;
  }

  error.hidden = true;
  estimateContent.hidden = false;
  estimateStatus.hidden = true;

  const risk = result.verdict === 'NALI_RISK';
  byId('verdict-box').dataset.risk = String(risk);
  byId('verdict').textContent = risk ? 'NALI_RISK · Review flagged terms' : 'COMPLIANT · Screened terms match';
  byId('gate-summary').textContent =
    `LVR at borrowing: ${decimal.format(result.lvr)}%. Cumulative term: ${decimal.format(result.totalYears)} years. ` +
    (result.propertyEligible ? 'Property category passes the borrowing restriction screen.' : 'Property category fails the borrowing restriction screen.');

  const gateMessages = {
    rate: result.expectedRate === null
      ? 'The fixed inception rate could not be verified for the selected date.'
      : `Actual interest is ${input.actualRate.toFixed(2)}%. The applicable benchmark is ${result.expectedRate.toFixed(2)}%.`,
    lvr: 'Combined borrowing exceeds 70% of the property value at borrowing.',
    term: 'The cumulative loan term exceeds 15 years, including prior loans.',
    repayment: 'The safe harbour requires monthly payments of both principal and interest.',
    mortgage: 'A registered mortgage securing the borrowing is required.',
    agreement: 'A written and executed loan agreement is required.',
    property: 'A new post-cutoff residential LRBA without a transitional exception fails the business real property test.',
    fixed_window: 'Check that the rate was fixed at commencement, the period is active and no longer than five years, and the rate reverts to variable by loan maturity.'
  };
  failedList.replaceChildren(...result.failedGates.map((gate) => {
    const item = document.createElement('li');
    item.textContent = gateMessages[gate];
    return item;
  }));
  failedList.hidden = !risk;

  const { tax } = result;
  const amounts = {
    'current-payment': result.currentPayment,
    'prior-payment': result.priorPayment,
    'payment-increase': result.paymentIncrease,
    'ordinary-rent': tax.ordinaryRent,
    'nali-rent': tax.naliRent,
    'rent-increase': tax.rentIncrease,
    'ordinary-sale': tax.ordinarySale,
    'nali-sale': tax.naliSale,
    'sale-increase': tax.saleIncrease
  };
  for (const [id, value] of Object.entries(amounts)) {
    byId(id).textContent = amount.format(value);
  }
  byId('taxable-gain').textContent = input.discountEligible
    ? `Taxable sale gain after the one-third CGT discount: ${amount.format(tax.taxableGain)}.`
    : `Taxable sale gain without a CGT discount: ${amount.format(tax.taxableGain)}.`;
}

form.addEventListener('input', renderEstimate);
form.addEventListener('submit', (event) => event.preventDefault());
renderEstimate();
