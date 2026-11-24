export const DEADLINE = '2027-01-30';
export const PRESCRIBED_RATE_2026 = 3;
export const ELIGIBLE_GROSS_UP = 1.38;
export const CAPITAL_GAINS_INCLUSION = 0.5;

const FEDERAL_DIVIDEND_CREDIT = 0.150198;
const PROVINCIAL_DIVIDEND_CREDIT = Object.freeze({
  ON: 0.1006,
  BC: 0.12,
  AB: 0.0812,
  QC: 0.117
});

const ASSETS = ['interest_foreign', 'eligible_dividends', 'capital_gains'];

function bounded(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

export function effectiveInvestmentRates(ordinaryRate, province) {
  if (!Object.hasOwn(PROVINCIAL_DIVIDEND_CREDIT, province)) {
    throw new RangeError('Select Ontario, British Columbia, Alberta or Québec.');
  }
  const ordinary = bounded(ordinaryRate, 0, 60, 'Marginal tax rate') / 100;
  const federalCredit = FEDERAL_DIVIDEND_CREDIT * (province === 'QC' ? 0.835 : 1);
  return {
    interest_foreign: ordinary,
    eligible_dividends: ELIGIBLE_GROSS_UP * Math.max(0,
      ordinary - federalCredit - PROVINCIAL_DIVIDEND_CREDIT[province]),
    capital_gains: ordinary * CAPITAL_GAINS_INCLUSION
  };
}

function weightedRate(rates, mix) {
  return ASSETS.reduce((total, asset) => total + rates[asset] * mix[asset] / 100, 0);
}

export function calculateSpousalLoan({
  principal, prescribedRate, portfolioYield, mix, lenderRate, borrowerRate,
  province, years, deduction = 'portfolio'
}) {
  bounded(principal, 0.01, 100_000_000, 'Loan principal (CAD)');
  bounded(prescribedRate, 1, 5, 'Locked loan rate (%)');
  bounded(portfolioYield, 0, 100, 'Expected portfolio yield (%)');
  bounded(years, 1, 30, 'Investment horizon (years)');
  if (!Number.isInteger(years)) throw new RangeError('Enter a whole number of years.');
  const highRates = effectiveInvestmentRates(lenderRate, province);
  const lowRates = effectiveInvestmentRates(borrowerRate, province);
  if (borrowerRate > lenderRate) {
    throw new RangeError('The borrower’s marginal rate must be at or below the lender’s rate.');
  }
  if (!['portfolio', 'otherIncome', 'none'].includes(deduction)) {
    throw new RangeError('Select an interest deduction assumption.');
  }
  const mixTotal = ASSETS.reduce((total, asset) =>
    total + bounded(mix?.[asset], 0, 100, 'Each portfolio share (%)'), 0);
  if (Math.abs(mixTotal - 100) > 1e-8) throw new RangeError('Portfolio shares must add up to 100%.');

  const highEffectiveRate = weightedRate(highRates, mix);
  const lowEffectiveRate = weightedRate(lowRates, mix);
  const loanRate = prescribedRate / 100;
  const yieldRate = portfolioYield / 100;
  const annualLoanInterest = principal * loanRate;
  const lenderInterestTax = annualLoanInterest * lenderRate / 100;
  const potentialDeduction = deduction === 'none' ? 0 : annualLoanInterest * borrowerRate / 100;
  const grossInvestmentReturn = principal * yieldRate;
  const taxWithoutLoan = grossInvestmentReturn * highEffectiveRate;
  const borrowerInvestmentTax = grossInvestmentReturn * lowEffectiveRate;
  const deductionUsed = investmentTax => deduction === 'otherIncome'
    ? potentialDeduction : Math.min(investmentTax, potentialDeduction);
  const borrowerDeductionBenefit = deductionUsed(borrowerInvestmentTax);
  const netFamilyTaxWithLoan = lenderInterestTax + borrowerInvestmentTax - borrowerDeductionBenefit;
  const annualFamilyTaxSavings = taxWithoutLoan - netFamilyTaxWithLoan;

  // The floored deduction changes the slope where borrower investment tax first exceeds the offset.
  const spread = highEffectiveRate - lowEffectiveRate;
  const floorRegionHurdle = highEffectiveRate > 0 ? lenderInterestTax / principal / highEffectiveRate : Infinity;
  const breakEvenRate = spread <= 0 ? null :
    deduction === 'portfolio' && floorRegionHurdle * lowEffectiveRate <= potentialDeduction / principal
      ? floorRegionHurdle
      : (lenderInterestTax - potentialDeduction) / principal / spread;

  let withoutLoan = principal;
  let withLoan = principal;
  let cumulativeTaxSavings = 0;
  const projection = [];
  for (let year = 1; year <= Math.max(years, 10); year++) {
    const baselineReturn = withoutLoan * yieldRate;
    const loanReturn = withLoan * yieldRate;
    const baselineTax = baselineReturn * highEffectiveRate;
    const investmentTax = loanReturn * lowEffectiveRate;
    const loanTax = lenderInterestTax + investmentTax - deductionUsed(investmentTax);
    cumulativeTaxSavings += baselineTax - loanTax;
    withoutLoan += baselineReturn - baselineTax;
    withLoan += loanReturn - loanTax;
    projection.push({
      year, withoutLoan, withLoan, cumulativeTaxSavings,
      compoundedSavings: withLoan - withoutLoan
    });
  }

  return {
    annualLoanInterest, grossInvestmentReturn, taxWithoutLoan, lenderInterestTax,
    borrowerInvestmentTax, borrowerDeductionBenefit, netFamilyTaxWithLoan, annualFamilyTaxSavings,
    highEffectiveRate, lowEffectiveRate,
    breakEvenYield: breakEvenRate === null ? null : breakEvenRate * 100,
    missedDeadlineCost: Math.max(0, annualFamilyTaxSavings),
    tenYear: projection[9], horizon: projection[years - 1]
  };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function check2026Payment({
  interestDue, prescribedRate, origin = '2026', priorPayments = 'unknown',
  method = 'none', paidDate = '', amountPaid = 0, asOf = ''
}) {
  bounded(interestDue, 0, 5_000_000, 'Annual interest (CAD)');
  bounded(amountPaid, 0, 100_000_000, 'Interest paid (CAD)');
  bounded(prescribedRate, 1, 5, 'Locked loan rate (%)');
  if (!['2026', 'legacy'].includes(origin) || !['unknown', 'onTime', 'missed'].includes(priorPayments)
      || !['none', 'cash', 'cheque', 'transfer', 'paper'].includes(method)
      || (paidDate && (!validDate(paidDate) || paidDate < '2026-01-01'))
      || (asOf && !validDate(asOf))) {
    throw new RangeError('Check the payment date, method and loan history.');
  }
  if (origin === '2026' && prescribedRate < PRESCRIBED_RATE_2026) return 'belowRate';
  if (origin === 'legacy' && priorPayments === 'missed') return 'priorMissed';

  const requiredCents = Math.round((interestDue + Number.EPSILON * interestDue) * 100);
  const fullPayment = amountPaid >= requiredCents / 100;
  if (requiredCents > 0) {
    if (paidDate && paidDate > DEADLINE) return 'missed';
    if (asOf > DEADLINE && (!paidDate || !fullPayment || method === 'none' || method === 'paper')) {
      return 'missed';
    }
    if (method === 'paper') return 'paperOnly';
    if (method === 'none' || !paidDate || (asOf && paidDate > asOf)) return 'pending';
    if (!fullPayment) return 'short';
  }
  if (origin === 'legacy' && priorPayments === 'unknown') return 'historyUnknown';
  return 'onTime';
}
