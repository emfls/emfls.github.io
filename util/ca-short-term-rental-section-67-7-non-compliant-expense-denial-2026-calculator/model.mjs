const federal = [[58523, 14], [117045, 20.5], [181440, 26], [258482, 29], [Infinity, 33]];
const provincial = {
  ON: [[53891, 5.05], [107785, 9.15], [150000, 11.16], [220000, 12.16], [Infinity, 13.16]],
  BC: [[50363, 5.6], [100728, 7.7], [115648, 10.5], [140430, 12.29], [190405, 14.7], [265545, 16.8], [Infinity, 20.5]],
  AB: [[61200, 8], [154259, 10], [185111, 12], [246813, 13], [370220, 14], [Infinity, 15]],
  QC: [[54345, 14], [108680, 19], [132245, 24], [Infinity, 25.75]],
};

export const MAX_AMOUNT = 1_000_000_000;

export function presetMarginalRate(province, taxableIncome) {
  if (!Object.hasOwn(provincial, province)) throw new RangeError('Choose a supported province.');
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0 || taxableIncome > MAX_AMOUNT) {
    throw new RangeError('Enter a valid taxable income.');
  }

  const federalRate = federal.find(([limit]) => taxableIncome <= limit)[1];
  const provincialRate = provincial[province].find(([limit]) => taxableIncome <= limit)[1];
  const adjustedFederalRate = province === 'QC' ? federalRate * 0.835 : federalRate;
  return (adjustedFederalRate + provincialRate) / 100;
}

export function calculateSection677({
  grossRevenue, mortgageInterest, propertyCosts, operatingCosts, cca = 0,
  strDays, nonCompliantDays, marginalRate, monthlyRent, leaseExpenses,
}) {
  const amounts = [grossRevenue, mortgageInterest, propertyCosts, operatingCosts, cca, monthlyRent, leaseExpenses];
  if (amounts.some(amount => !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT)) {
    throw new RangeError('Enter each CAD amount between $0 and $1 billion.');
  }
  if (!Number.isInteger(strDays) || strDays < 1 || strDays > 365) {
    throw new RangeError('Total STR days must be a whole number from 1 to 365.');
  }
  if (!Number.isInteger(nonCompliantDays) || nonCompliantDays < 0 || nonCompliantDays > strDays) {
    throw new RangeError('Non-compliant days must be a whole number between 0 and total STR days.');
  }
  if (!Number.isFinite(marginalRate) || marginalRate < 0 || marginalRate > 1) {
    throw new RangeError('The marginal tax rate must be between 0% and 100%.');
  }

  const cashExpenses = mortgageInterest + propertyCosts + operatingCosts;
  const preTaxCashFlow = grossRevenue - cashExpenses;
  if (Math.round(cca * 100) > Math.max(0, Math.round(preTaxCashFlow * 100))) {
    throw new RangeError('CCA cannot create or increase a rental loss in this single-property model.');
  }

  const expenseBase = cashExpenses + cca;
  const nonCompliantShare = nonCompliantDays / strDays;
  const deniedExpenses = expenseBase * nonCompliantShare;
  const deniedCCA = cca * nonCompliantShare;
  const allowedExpenses = expenseBase - deniedExpenses;

  const trueNetProfit = grossRevenue - expenseBase;
  const compliantTaxable = trueNetProfit;
  const nonCompliantTaxable = grossRevenue - allowedExpenses;
  const tax = income => Math.max(0, income) * marginalRate;
  const compliantTax = tax(compliantTaxable);
  const nonCompliantTax = tax(nonCompliantTaxable);
  const extraSection677PenaltyTax = nonCompliantTax - compliantTax;
  const compliantAfterTax = preTaxCashFlow - compliantTax;
  const nonCompliantAfterTax = preTaxCashFlow - nonCompliantTax;
  const effectiveTaxRateOnTrueCashFlow = preTaxCashFlow > 0 ? nonCompliantTax / preTaxCashFlow * 100 : Infinity;

  const leaseTaxable = 12 * monthlyRent - leaseExpenses;
  const leaseTax = tax(leaseTaxable);
  const leaseAfterTax = leaseTaxable - leaseTax;
  const leaseAdvantage = leaseAfterTax - nonCompliantAfterTax;
  // Positive lease income keeps only the after-tax fraction. Losses receive no tax benefit.
  const matchingLeaseNetBeforeTax = nonCompliantAfterTax > 0
    ? nonCompliantAfterTax / (1 - marginalRate)
    : nonCompliantAfterTax;
  const breakEvenMonthlyRent = Math.max(0, (leaseExpenses + matchingLeaseNetBeforeTax) / 12);

  return {
    expenseBase, nonCompliantShare, deniedExpenses, deniedCCA, allowedExpenses,
    trueNetProfit, preTaxCashFlow, compliantTaxable, compliantTax,
    nonCompliantTaxable, nonCompliantTax, extraSection677PenaltyTax,
    compliantAfterTax, nonCompliantAfterTax, effectiveTaxRateOnTrueCashFlow,
    leaseTaxable, leaseTax, leaseAfterTax, leaseAdvantage, breakEvenMonthlyRent,
  };
}
