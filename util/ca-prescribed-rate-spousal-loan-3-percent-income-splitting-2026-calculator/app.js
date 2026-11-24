import { calculateSpousalLoan, check2026Payment } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('calculator');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 });
const money = amount => currency.format(Math.abs(amount) < 0.005 ? 0 : amount);
const put = (id, value) => { get(id).textContent = value; };
const number = id => get(id).valueAsNumber;

const paymentMessages = {
  belowRate: 'The entered rate is below the 3.0% prescribed rate for a new 2026 loan. This calculator’s prescribed-rate test fails.',
  priorMissed: 'An earlier missed payment disqualifies this loan under the continuing annual payment rule.',
  missed: 'Full payment by January 30, 2027 was missed in this scenario. The qualifying-loan results below are for comparison.',
  paperOnly: 'A new promissory note or journal entry alone does not satisfy this payment check.',
  pending: 'Payment timing is unverified. Enter the method, cleared date and total actually paid to run the check.',
  short: 'The entered payment is below the full annual interest due. Pay any remaining balance by January 30, 2027.',
  historyUnknown: 'The 2026 payment passes the timing and amount check. Confirm every prior year’s payment and the original rate for this legacy loan.',
  onTime: 'The entered figures pass the annual payment check. Loan documentation, investment use and the original rate still determine eligibility.'
};

function localDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
}

function render() {
  const origin = get('origin').value;
  const prescribedRate = number('prescribed-rate');
  get('history-field').hidden = origin !== 'legacy';

  let result;
  let payment;
  try {
    result = calculateSpousalLoan({
      principal: number('principal'),
      prescribedRate,
      portfolioYield: number('portfolio-yield'),
      mix: {
        interest_foreign: number('interest_foreign'),
        eligible_dividends: number('eligible_dividends'),
        capital_gains: number('capital_gains')
      },
      lenderRate: number('lender-rate'),
      borrowerRate: number('borrower-rate'),
      province: get('province').value,
      years: number('years'),
      deduction: get('deduction').value
    });
    const amount = get('amount-paid');
    if (!amount.validity.valid || !get('paid-date').validity.valid) {
      throw new RangeError('Enter a payment date in 2026 or later and a non-negative amount with up to two decimal places.');
    }
    payment = check2026Payment({
      interestDue: result.annualLoanInterest,
      prescribedRate,
      origin,
      priorPayments: get('prior-payments').value,
      method: get('method').value,
      paidDate: get('paid-date').value,
      amountPaid: amount.value === '' ? 0 : amount.valueAsNumber,
      asOf: localDate()
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    put('input-error', error.message);
    put('payment-status', '');
    put('deadline-cost', '');
    get('results').hidden = true;
    return;
  }

  put('input-error', '');
  put('payment-status', paymentMessages[payment]);
  get('payment-status').dataset.warning = !['pending', 'onTime', 'historyUnknown'].includes(payment);
  const amounts = {
    'annual-savings': result.annualFamilyTaxSavings,
    'interest-due': result.annualLoanInterest,
    'gross-return': result.grossInvestmentReturn,
    'tax-without': result.taxWithoutLoan,
    'lender-tax': result.lenderInterestTax,
    'borrower-tax': result.borrowerInvestmentTax,
    'deduction-benefit': result.borrowerDeductionBenefit,
    'tax-with': result.netFamilyTaxWithLoan,
    'ten-year-tax': result.tenYear.cumulativeTaxSavings,
    'ten-year-compounded': result.tenYear.compoundedSavings,
    'horizon-compounded': result.horizon.compoundedSavings
  };
  Object.entries(amounts).forEach(([id, value]) => put(id, money(value)));
  const hurdle = result.breakEvenYield;
  put('break-even', hurdle === null ? 'No yield beats baseline' : `${percent.format(hurdle)}%`);
  const gap = result.annualFamilyTaxSavings;
  const summary = Math.abs(gap) < 0.005 ? 'The modeled first-year family tax is the same in both cases.'
    : `The qualifying loan ${gap > 0 ? 'reduces' : 'increases'} first-year family tax by ${money(Math.abs(gap))}.`;
  put('estimate-summary', summary);
  put('horizon-label', `${result.horizon.year}-year compounded after-tax advantage`);
  get('horizon-row').hidden = result.horizon.year === 10;
  put('deadline-cost', `Modeled first-year tax benefit at risk: ${money(result.missedDeadlineCost)} CAD.`);
  get('results').hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
form.querySelectorAll('[data-rate]').forEach(button => {
  button.addEventListener('click', () => {
    get('prescribed-rate').value = button.dataset.rate;
    render();
  });
});
render();
