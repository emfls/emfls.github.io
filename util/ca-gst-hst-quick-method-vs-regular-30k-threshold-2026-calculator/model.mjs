export const SMALL_SUPPLIER_LIMIT = 30_000;
export const QUICK_METHOD_LIMIT = 400_000;
export const CREDIT_SALES_LIMIT = 30_000;
export const MAX_AMOUNT = 1_000_000_000;

// RC4058 same-rate supply and permanent establishment columns. Quebec is GST only.
export const RATES = Object.freeze({
  ON: Object.freeze({ tax: 0.13, service: 0.088, resale: 0.044 }),
  GST: Object.freeze({ tax: 0.05, service: 0.036, resale: 0.018 }),
  NS: Object.freeze({ tax: 0.14, service: 0.094, resale: 0.047 }),
  ATL: Object.freeze({ tax: 0.15, service: 0.10, resale: 0.05 }),
  QC: Object.freeze({ tax: 0.05, service: 0.036, resale: 0.018 }),
});

function amount(value) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
    throw new RangeError('Enter a non-negative CAD amount up to $1 billion.');
  }
  return value;
}

export function checkSmallSupplier(quarters) {
  if (!Array.isArray(quarters) || quarters.length !== 4) {
    throw new RangeError('Enter four consecutive calendar quarters.');
  }
  const cents = Array.from(quarters, value => Math.round(amount(value) * 100));
  const total = cents.reduce((sum, value) => sum + value, 0) / 100;
  const highestQuarter = Math.max(...cents) / 100;
  return {
    total,
    highestQuarter,
    status: highestQuarter > SMALL_SUPPLIER_LIMIT ? 'single-quarter'
      : total > SMALL_SUPPLIER_LIMIT ? 'rolling-quarters' : 'within-limit',
  };
}

export function checkQuickMethod(salesWithTax, qualifications) {
  amount(salesWithTax);
  if (!['met', 'excluded', 'unconfirmed'].includes(qualifications)) {
    throw new RangeError('Select a Quick Method qualification status.');
  }
  if (qualifications === 'excluded') return 'excluded';
  if (salesWithTax > QUICK_METHOD_LIMIT) return 'over-limit';
  return qualifications === 'met' ? 'passes' : 'unconfirmed';
}

export function compareMethods({
  region, businessType, sales, eligibleExpenses, otherExpenses,
  operatingITCs, capitalITCs, incomeTaxRate, qualifiesForCredit,
}) {
  if (!Object.hasOwn(RATES, region) || !['service', 'resale'].includes(businessType)) {
    throw new RangeError('Select a valid province group and business category.');
  }
  for (const value of [sales, eligibleExpenses, otherExpenses, operatingITCs, capitalITCs]) {
    amount(value);
  }
  if (!Number.isFinite(incomeTaxRate) || incomeTaxRate < 0 || incomeTaxRate >= 1) {
    throw new RangeError('Enter an income tax rate from 0% to less than 100%.');
  }
  if (typeof qualifiesForCredit !== 'boolean') {
    throw new TypeError('Confirm whether the 1% credit applies.');
  }
  if (operatingITCs > 0 && eligibleExpenses === 0) {
    throw new RangeError('Enter the pre-tax expenses associated with your operating ITCs.');
  }

  const rates = RATES[region];
  const quickRate = rates[businessType];
  const taxCollected = sales * rates.tax;
  const grossTaxIncludedSales = sales + taxCollected;
  const credit1Pct = qualifiesForCredit ? 0.01 * Math.min(CREDIT_SALES_LIMIT, grossTaxIncludedSales) : 0;
  const quickTaxBeforeITCs = grossTaxIncludedSales * quickRate - credit1Pct;
  const regularRemittance = taxCollected - operatingITCs - capitalITCs;
  const quickRemittance = quickTaxBeforeITCs - capitalITCs;

  const retainedTaxIncome = taxCollected - quickTaxBeforeITCs;
  // Unrecovered operating GST/HST is also deductible under the model assumptions.
  const preTaxSavings = retainedTaxIncome - operatingITCs;
  const extraIncomeTax = preTaxSavings * incomeTaxRate;
  const afterTaxSavings = preTaxSavings - extraIncomeTax;
  const regularOperatingProfit = sales - eligibleExpenses - otherExpenses;
  const operatingITCRate = eligibleExpenses > 0 ? operatingITCs / eligibleExpenses : rates.tax;

  return {
    quickRate, taxCollected, grossTaxIncludedSales, credit1Pct,
    regularRemittance, quickRemittance, retainedTaxIncome, preTaxSavings,
    extraIncomeTax, afterTaxSavings,
    regularAfterTaxProfit: regularOperatingProfit * (1 - incomeTaxRate),
    quickAfterTaxProfit: (regularOperatingProfit + preTaxSavings) * (1 - incomeTaxRate),
    breakEvenExpenseRatio: sales > 0 && operatingITCRate > 0
      ? retainedTaxIncome / operatingITCRate / sales : null,
    currentExpenseRatio: sales > 0 ? eligibleExpenses / sales : null,
    operatingITCRate,
    winner: Math.abs(afterTaxSavings) < 0.005 ? 'tie' : afterTaxSavings > 0 ? 'quick' : 'regular',
  };
}
