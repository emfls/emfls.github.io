const BRACKETS = [
  [58_523, 0.14],
  [117_045, 0.205],
  [181_440, 0.26],
  [258_482, 0.29],
  [Infinity, 0.33],
];

const WITHHOLDING_RATE = 0.25;
const SURTAX_RATE = 0.48;
const MONTHS = 12;
const MAX_AMOUNT = 1_000_000_000;
const EXPENSE_FIELDS = ['mortgageInterest', 'propertyTax', 'insurance', 'condoFees', 'managementMaintenance'];

export function federalTax(taxableIncome) {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0) {
    throw new RangeError('Taxable income must be finite and nonnegative.');
  }

  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of BRACKETS) {
    tax += (Math.min(taxableIncome, upper) - lower) * rate;
    if (taxableIncome <= upper) break;
    lower = upper;
  }
  return tax;
}

// Inputs are property totals in CAD before applying the owner's share.
export function calculateRentalTax(inputs) {
  for (const field of ['monthlyRent', ...EXPENSE_FIELDS, 'requestedCca']) {
    const amount = inputs[field];
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      throw new RangeError(`Invalid amount for ${field}.`);
    }
  }

  const { ownershipShare, withholdingMethod } = inputs;
  if (!Number.isFinite(ownershipShare) || ownershipShare < 1 || ownershipShare > 100) {
    throw new RangeError('Ownership share must be from 1% to 100%.');
  }
  if (withholdingMethod !== 'default_25_gross' && withholdingMethod !== 'approved_nr6_25_net') {
    throw new RangeError('Invalid withholding method.');
  }

  const share = ownershipShare / 100;
  const grossAnnualRent = inputs.monthlyRent * MONTHS * share;
  const annualExpenses = EXPENSE_FIELDS.reduce((sum, field) => sum + inputs[field], 0) * share;
  const netBeforeCca = grossAnnualRent - annualExpenses;
  const positiveNet = Math.max(0, netBeforeCca);
  const ccaApplied = Math.min(positiveNet, inputs.requestedCca * share);
  const taxableRentalIncome = positiveNet - ccaApplied;

  const defaultAnnualWithholding = grossAnnualRent * WITHHOLDING_RATE;
  const nr6AnnualWithholding = positiveNet * WITHHOLDING_RATE;
  const annualCashFlowRelief = defaultAnnualWithholding - nr6AnnualWithholding;
  const withheldAnnual = withholdingMethod === 'approved_nr6_25_net'
    ? nr6AnnualWithholding : defaultAnnualWithholding;

  const basicFederalTax = federalTax(taxableRentalIncome);
  const federalSurtax = basicFederalTax * SURTAX_RATE;
  const totalSection216Tax = basicFederalTax + federalSurtax;
  const settlement = withheldAnnual - totalSection216Tax;

  return {
    grossAnnualRent,
    annualExpenses,
    netBeforeCca,
    ccaApplied,
    taxableRentalIncome,
    defaultAnnualWithholding,
    defaultMonthlyWithholding: defaultAnnualWithholding / MONTHS,
    nr6AnnualWithholding,
    nr6MonthlyWithholding: nr6AnnualWithholding / MONTHS,
    annualCashFlowRelief,
    withheldAnnual,
    basicFederalTax,
    federalSurtax,
    totalSection216Tax,
    refund: Math.max(0, settlement),
    balanceOwing: Math.max(0, -settlement),
    annualTaxSavings: defaultAnnualWithholding - totalSection216Tax,
    missedDeadlineShortfall: annualCashFlowRelief,
  };
}
