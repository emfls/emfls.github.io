export const RATES = Object.freeze({
  small: 0.19,
  main: 0.25,
  fraction: 3 / 200,
  lower: 50000,
  upper: 250000,
  annualAia: 1000000,
});

function checkAmount(value, name, min = 0, max = Number.MAX_SAFE_INTEGER / 100) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} is outside the supported range.`);
  }
}

export function calculateCorporationTax({
  taxableProfits,
  exemptDistributions = 0,
  associatedCompanies = 0,
  accountingDays = 365,
}) {
  checkAmount(taxableProfits, 'Taxable profits', -Number.MAX_SAFE_INTEGER / 100);
  checkAmount(exemptDistributions, 'Exempt distributions');
  if (!Number.isSafeInteger(associatedCompanies) || associatedCompanies < 0 ||
      associatedCompanies >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Enter a whole, non-negative number of other associated companies.');
  }
  if (!Number.isInteger(accountingDays) || accountingDays < 1 || accountingDays > 365) {
    throw new RangeError('Enter an accounting period of 1 to 365 days.');
  }

  const divisor = 1 + associatedCompanies;
  const periodFactor = accountingDays / 365;
  const lowerLimit = RATES.lower / divisor * periodFactor;
  const upperLimit = RATES.upper / divisor * periodFactor;
  const profits = Math.max(0, taxableProfits);
  const augmentedProfits = profits + exemptDistributions;
  const band = augmentedProfits <= lowerLimit ? 'small'
    : augmentedProfits >= upperLimit ? 'main' : 'marginal';
  const relief = band === 'marginal'
    ? (upperLimit - augmentedProfits) * (profits / augmentedProfits) * RATES.fraction
    : 0;
  const tax = (band === 'small' ? RATES.small : RATES.main) * profits - relief;

  return {
    divisor, periodFactor, lowerLimit, upperLimit, taxableProfits: profits, augmentedProfits,
    band, relief, tax, effectiveRate: profits > 0 ? tax / profits : null,
  };
}

export function calculateScenario({
  fullExpensing = 0,
  aiaSpend = 0,
  aiaAvailable,
  pension = 0,
  ...taxInputs
}) {
  checkAmount(fullExpensing, 'Full expensing');
  checkAmount(aiaSpend, 'AIA expenditure');
  checkAmount(pension, 'Employer pension contribution');
  const before = calculateCorporationTax(taxInputs);
  const available = aiaAvailable ?? RATES.annualAia * before.periodFactor;
  checkAmount(available, 'Available AIA', 0, RATES.annualAia);
  const aiaClaim = Math.min(aiaSpend, available);
  let after = before;
  let remainingProfits = taxInputs.taxableProfits;

  // Attribute each saving against the previous stage so the rows add up to the total.
  const steps = [
    { id: 'full-expensing', spend: fullExpensing, deduction: fullExpensing },
    { id: 'aia', spend: aiaSpend, deduction: aiaClaim },
    { id: 'pension', spend: pension, deduction: pension },
  ].map((step) => {
    const previousTax = after.tax;
    remainingProfits -= step.deduction;
    // Current-period liability stops at zero even if the deductions create a loss.
    after = calculateCorporationTax({ ...taxInputs, taxableProfits: Math.max(0, remainingProfits) });
    const saved = Math.max(0, previousTax - after.tax);
    return { ...step, saved, savingsRate: step.deduction > 0 ? saved / step.deduction : null };
  });

  const totalSaved = Math.max(0, before.tax - after.tax);
  return {
    before, after, steps, totalSaved, aiaAvailable: available, aiaExcess: aiaSpend - aiaClaim,
    cashCost: fullExpensing + aiaSpend + pension - totalSaved,
  };
}
