const RESIDENT_BRACKETS = [
  [18200, 45000, 0.15],
  [45000, 135000, 0.30],
  [135000, 190000, 0.37],
  [190000, Infinity, 0.45]
];
const MEDICARE_THRESHOLD = 28011;
const MEDICARE_PHASE_IN_LIMIT = 35013;
const ENTITIES = ['individual', 'pension', 'accumulation', 'company'];
const COMPANY_RATES = [0.25, 0.30];
const MAX_AMOUNT = 1_000_000_000;

export function residentIncomeTax(taxableIncome) {
  return RESIDENT_BRACKETS.reduce((tax, [lower, upper, rate]) =>
    tax + Math.max(0, Math.min(taxableIncome, upper) - lower) * rate, 0);
}

export function medicareLevy(taxableIncome) {
  if (taxableIncome > MEDICARE_PHASE_IN_LIMIT) return taxableIncome * 0.02;
  return Math.max(0, taxableIncome - MEDICARE_THRESHOLD) * 0.10;
}

function validateRange(value, max, label) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-AU')}.`);
  }
}

export function calculateDividend({
  cashDividend, investmentValue, frankingPercentage, imputationRate, entity,
  otherTaxableIncome = 0, includeMedicare = false, eligibleForCredits = true,
  companyTaxRate = 0.25
}) {
  validateRange(cashDividend, MAX_AMOUNT, 'Cash dividend');
  validateRange(investmentValue, MAX_AMOUNT, 'Investment value');
  validateRange(otherTaxableIncome, MAX_AMOUNT, 'Other taxable income');
  validateRange(frankingPercentage, 100, 'Franked portion');
  if (!ENTITIES.includes(entity)) throw new RangeError('Select an investor type.');
  if (!COMPANY_RATES.includes(imputationRate)) throw new RangeError('Select a 25% or 30% imputation rate.');
  const isCompany = entity === 'company';
  if (isCompany && !COMPANY_RATES.includes(companyTaxRate)) {
    throw new RangeError('Select a 25% or 30% shareholder company tax rate.');
  }

  const attachedCredit = cashDividend * imputationRate / (1 - imputationRate) * (frankingPercentage / 100);
  const frankingCredit = eligibleForCredits ? attachedCredit : 0;
  const grossedUpDividend = cashDividend + frankingCredit;
  const taxableIncome = otherTaxableIncome + grossedUpDividend;

  const flatRate = isCompany ? companyTaxRate : entity === 'accumulation' ? 0.15 : 0;
  const incomeTax = entity === 'individual' ? residentIncomeTax : income => income * flatRate;
  const levy = entity === 'individual' && includeMedicare ? medicareLevy : () => 0;
  const incomeTaxWithDividend = incomeTax(taxableIncome);
  const levyWithDividend = levy(taxableIncome);
  const incrementalIncomeTax = incomeTaxWithDividend - incomeTax(otherTaxableIncome);
  const incrementalMedicare = levyWithDividend - levy(otherTaxableIncome);
  const liabilityWithDividend = incomeTaxWithDividend + levyWithDividend;

  const creditApplied = Math.min(frankingCredit, liabilityWithDividend);
  const excessCredit = Math.max(0, frankingCredit - liabilityWithDividend);
  const cashRefund = isCompany ? 0 : excessCredit;
  const unusedCompanyCredit = isCompany ? excessCredit : 0;
  const incrementalNetTax = incrementalIncomeTax + incrementalMedicare - creditApplied - cashRefund;
  const netDividend = cashDividend - incrementalNetTax;
  const yieldOn = amount => {
    const percent = (amount / investmentValue) * 100;
    return Number.isFinite(percent) ? percent : null;
  };

  return {
    attachedCredit, frankingCredit, grossedUpDividend,
    incrementalIncomeTax, incrementalMedicare, creditApplied, incrementalNetTax,
    cashRefund, unusedCompanyCredit, netDividend,
    cashYield: yieldOn(cashDividend), grossedUpYield: yieldOn(grossedUpDividend),
    netYield: yieldOn(netDividend)
  };
}
