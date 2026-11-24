const WEEKS_PER_YEAR = 52;
const STANDARD_MEDICARE_LEVY = 0.02;
const RESIDENT_BRACKETS = [
  { lower: 18200, upper: 45000, rate: 0.15 },
  { lower: 45000, upper: 135000, rate: 0.30 },
  { lower: 135000, upper: 190000, rate: 0.37 },
  { lower: 190000, upper: Infinity, rate: 0.45 },
];

const ESTABLISHED_AFTER_CUTOFF = 'established_post_12_may_2026';
const ACQUISITION_TYPES = new Set([
  'grandfathered_pre_12_may_2026',
  'new_build_exempt',
  ESTABLISHED_AFTER_CUTOFF,
]);
const CASH_EXPENSE_FIELDS = [
  'annualLoanInterest', 'propertyManagementFees', 'councilWaterRates',
  'strataLandTax', 'insuranceMaintenance',
];
const MONEY_FIELDS = ['taxableIncome', 'weeklyRent', 'division43', 'division40', ...CASH_EXPENSE_FIELDS];

export function residentTax(taxableIncome) {
  if (!Number.isFinite(taxableIncome)) throw new RangeError('Taxable income must be finite.');
  const income = Math.max(0, taxableIncome);
  const incomeTax = RESIDENT_BRACKETS.reduce(
    (total, { lower, upper, rate }) => total + Math.max(0, Math.min(income, upper) - lower) * rate,
    0,
  );
  return incomeTax + income * STANDARD_MEDICARE_LEVY;
}

function scenario(taxableIncome, taxableNetRental, preTaxCashflow, propertyValue, usesQuarantine) {
  const rentalLoss = Math.max(0, -taxableNetRental);
  const taxableIncomeWithProperty = Math.max(
    0,
    taxableIncome + (usesQuarantine ? Math.max(0, taxableNetRental) : taxableNetRental),
  );
  const taxWithoutProperty = residentTax(taxableIncome);
  const taxWithProperty = residentTax(taxableIncomeWithProperty);
  const taxRefund = taxWithoutProperty - taxWithProperty;
  const afterTaxAnnualCashflow = preTaxCashflow + taxRefund;

  return {
    usesQuarantine,
    taxableIncomeWithProperty,
    taxWithoutProperty,
    taxWithProperty,
    taxRefund,
    afterTaxAnnualCashflow,
    weeklyAfterTaxCost: -afterTaxAnnualCashflow / WEEKS_PER_YEAR || 0,
    breakEvenGrowthRate: Math.max(0, -afterTaxAnnualCashflow) / propertyValue,
    quarantinedLoss: usesQuarantine ? rentalLoss : 0,
    netInvestmentLossAddBack: usesQuarantine ? 0 : rentalLoss,
  };
}

export function calculateRental(inputs) {
  for (const field of MONEY_FIELDS) {
    if (!Number.isFinite(inputs[field]) || inputs[field] < 0 || inputs[field] > 1e12) {
      throw new RangeError(`Invalid amount for ${field}.`);
    }
  }

  const { taxableIncome, propertyValue, weeklyRent, vacancyWeeks, division43, division40, acquisitionType } = inputs;
  if (!Number.isFinite(propertyValue) || propertyValue < 0.01 || propertyValue > 1e12) {
    throw new RangeError('Property value must be at least one cent.');
  }
  if (!Number.isFinite(vacancyWeeks) || vacancyWeeks < 0 || vacancyWeeks > WEEKS_PER_YEAR) {
    throw new RangeError('Vacancy must be between 0 and 52 weeks.');
  }
  if (!ACQUISITION_TYPES.has(acquisitionType)) throw new RangeError('Unknown acquisition type.');

  const grossAnnualRent = weeklyRent * (WEEKS_PER_YEAR - vacancyWeeks);
  const cashExpenses = CASH_EXPENSE_FIELDS.reduce((total, field) => total + inputs[field], 0);
  const preTaxCashflow = grossAnnualRent - cashExpenses;
  const nonCashDepreciation = division43 + division40;
  const taxableNetRental = preTaxCashflow - nonCashDepreciation;

  return {
    grossAnnualRent,
    cashExpenses,
    preTaxCashflow,
    nonCashDepreciation,
    taxableNetRental,
    current: scenario(taxableIncome, taxableNetRental, preTaxCashflow, propertyValue, false),
    // Apply the reform to the same tax schedule to isolate the effect of quarantine.
    reform: scenario(
      taxableIncome, taxableNetRental, preTaxCashflow, propertyValue, acquisitionType === ESTABLISHED_AFTER_CUTOFF,
    ),
  };
}
