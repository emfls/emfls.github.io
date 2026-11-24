export const BENCHMARK_RATE = 0.0877;
export const FRANKING_RATE = 0.25;
export const MAX_TERM = Object.freeze({ unsecured_7yr: 7, secured_25yr: 25 });
const MAX_AMOUNT = 1_000_000_000_000;
export const MARGINAL_RATES = Object.freeze([0.17, 0.32, 0.39, 0.47]);

export function calculateDivision7A({
  openingPrincipalBalance,
  loanType,
  remainingYears,
  actualRepaymentMade,
  distributableSurplus,
  shareholderMarginalRate,
  annualRate = BENCHMARK_RATE,
}) {
  if (!Object.hasOwn(MAX_TERM, loanType)) {
    throw new RangeError('Choose a supported loan type.');
  }
  if (!Number.isInteger(remainingYears) || remainingYears < 1 || remainingYears > MAX_TERM[loanType]) {
    throw new RangeError('Enter a whole remaining term within the selected loan limit.');
  }
  if (!Number.isFinite(openingPrincipalBalance) || openingPrincipalBalance < 0.01 ||
      openingPrincipalBalance > MAX_AMOUNT || ![actualRepaymentMade, distributableSurplus]
        .every(value => Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT)) {
    throw new RangeError('Enter a positive opening balance and non-negative repayments and surplus, each up to A$1 trillion.');
  }
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1 ||
      !MARGINAL_RATES.includes(shareholderMarginalRate)) {
    throw new RangeError('Choose a listed marginal rate and an annual rate from 0% to 100%.');
  }

  // Evaluate the statutory denominator without subtracting nearly equal numbers.
  const repaymentFactor = annualRate === 0 ? 1 / remainingYears :
    annualRate / -Math.expm1(-remainingYears * Math.log1p(annualRate));
  const myr = openingPrincipalBalance * repaymentFactor;
  const shortfall = Math.max(0, myr - actualRepaymentMade);
  const deemedUnfrankedDividend = Math.min(shortfall, distributableSurplus);
  const personalTaxShock = deemedUnfrankedDividend * shareholderMarginalRate;
  const frankingCredit = shortfall * (FRANKING_RATE / (1 - FRANKING_RATE));
  const frankedTax = (shortfall + frankingCredit) * shareholderMarginalRate - frankingCredit;

  let openingBalance = openingPrincipalBalance;
  let totalInterest = 0;
  const schedule = [];
  for (let year = 1; year <= remainingYears; year += 1) {
    const interest = openingBalance * annualRate;
    const principalPaid = year === remainingYears ? openingBalance : Math.min(openingBalance, myr - interest);
    const repayment = year === remainingYears ? principalPaid + interest : myr;
    const closingBalance = Math.max(0, openingBalance - principalPaid);
    schedule.push({ year, openingBalance, repayment, interest, principalPaid, closingBalance });
    totalInterest += interest;
    openingBalance = closingBalance;
  }

  return {
    myr, shortfall, deemedUnfrankedDividend, personalTaxShock, cashTax: 0,
    frankingCredit, frankedTax, taxSavedWithCash: personalTaxShock,
    taxSavedWithFrankedDividend: personalTaxShock - frankedTax,
    schedule, totalInterest,
  };
}
