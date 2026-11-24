const section455Rates = new Map([
  ['post_6_apr_2026_35_75pct', 3575],
  ['pre_6_apr_2026_33_75pct', 3375],
]);
const directorRates = new Set([20, 40, 45]);
const dividendRates = [1075, 3575, 3935];
const officialInterestRate = 375;
const class1aRate = 1500;
const smallLoanLimit = 1_000_000;
const repaymentMatchThreshold = 500_000;

function toPence(amount, label) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000 || amount !== pence / 100) {
    throw new RangeError(`${label} must be between £0 and £1 billion, to the nearest penny.`);
  }
  return pence;
}

function tax(pence, basisPoints) {
  return Math.round(pence * basisPoints / 10_000) / 100;
}

/**
 * One original loan cohort. The deadline balance is for that cohort alone,
 * after cash repayments but before any statutory matching.
 * matchedAmount is the same sum repaid and qualifying for matching on redraw.
 */
export function calculateDirectorLoan({
  regime, peakBalance, deadlineBalance, daysOverdrawn, interestPaid, directorBand,
  matchRepayment = false, matchedAmount = 0,
}) {
  const rate = section455Rates.get(regime);
  if (!rate) throw new RangeError('Select a supported loan origination period.');
  if (!directorRates.has(directorBand)) throw new RangeError('Select a supported director tax band.');
  if (!Number.isInteger(daysOverdrawn) || daysOverdrawn < 1 || daysOverdrawn > 365) {
    throw new RangeError('Days overdrawn must be a whole number from 1 to 365.');
  }
  if (typeof matchRepayment !== 'boolean') throw new TypeError('Select whether a qualifying redraw is planned.');

  const peak = toPence(peakBalance, 'Peak balance');
  const unpaid = toPence(deadlineBalance, 'Deadline balance');
  const interest = toPence(interestPaid, 'Interest paid');
  const planned = matchRepayment ? toPence(matchedAmount, 'Repayment and redraw') : 0;
  const matched = planned >= repaymentMatchThreshold ? planned : 0;
  const chargeable = unpaid + matched;

  // shortcut: hold the peak constant on overdrawn days. Use a dated balance
  // history and actual rates for a precise-method calculation.
  const exempt = peak <= smallLoanLimit;
  // 3.75% simplifies to 3/80, so compute the required pennies from integers.
  const dailyInterest = exempt ? 0 : peak * (officialInterestRate / 125) * daysOverdrawn / (80 * 365);
  const taxableBenefit = Math.round(Math.max(0, dailyInterest - interest));

  return {
    section455Rate: rate / 100,
    matchedRepayment: matched / 100,
    chargeableBalance: chargeable / 100,
    section455Tax: tax(chargeable, rate),
    bikExempt: exempt,
    taxableBenefit: taxableBenefit / 100,
    directorIncomeTax: tax(taxableBenefit, directorBand * 100),
    companyClass1a: tax(taxableBenefit, class1aRate),
    interestNeededToEliminateBiK: Math.ceil(dailyInterest) / 100,
    additionalInterestNeeded: Math.max(0, Math.ceil(dailyInterest) - interest) / 100,
    dividendToClear: chargeable / 100,
    dividendTaxes: dividendRates.map(basisPoints => ({
      rate: basisPoints / 100,
      tax: tax(chargeable, basisPoints),
    })),
  };
}
