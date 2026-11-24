export const CAR_RATE = 0.91;
export const PREVIOUS_CAR_RATE = 0.88;
export const KM_CAP = 5000;
export const CAR_LIMIT = 69883;

const TAX_BANDS = [
  [18200, 45000, 0.15],
  [45000, 135000, 0.30],
  [135000, 190000, 0.37],
  [190000, Infinity, 0.45],
];

function validateAmount(name, value) {
  if (!Number.isFinite(value) || value < 0 || value > 1e9) {
    throw new RangeError(`${name} must be between 0 and 1 billion.`);
  }
}

export function residentIncomeTax(taxableIncome) {
  validateAmount('taxableIncome', taxableIncome);
  return TAX_BANDS.reduce((tax, [lower, upper, rate]) => (
    tax + Math.max(0, Math.min(taxableIncome, upper) - lower) * rate
  ), 0);
}

function depreciation({ depreciationMethod, carPurchasePrice, actualDepreciation }) {
  if (depreciationMethod === 'actual') {
    validateAmount('actualDepreciation', actualDepreciation);
    return actualDepreciation;
  }
  if (depreciationMethod !== 'diminishing' && depreciationMethod !== 'prime') {
    throw new RangeError('Choose a depreciation method.');
  }
  validateAmount('carPurchasePrice', carPurchasePrice);
  return Math.min(carPurchasePrice, CAR_LIMIT) * (depreciationMethod === 'diminishing' ? 0.25 : 0.125);
}

function findBreakEven(totalAnnualKm, annualCosts) {
  if (totalAnnualKm === 0) return { kind: 'no-travel' };

  // Below the cap, both deductions scale with work kilometres. Only the logbook keeps growing after it.
  const costPerKm = annualCosts / totalAnnualKm;
  if (Math.abs(costPerKm - CAR_RATE) < 1e-12) {
    return { kind: totalAnnualKm <= KM_CAP ? 'tie-throughout' : 'tie-until-cap' };
  }
  if (costPerKm > CAR_RATE) return { kind: 'logbook-ahead' };
  const cappedDeduction = KM_CAP * CAR_RATE;
  if (annualCosts < cappedDeduction) return { kind: 'cents-ahead' };
  return { kind: 'crossing', km: totalAnnualKm * (cappedDeduction / annualCosts) };
}

export function compareCarExpenses(inputs) {
  const { businessKm, totalAnnualKm, taxableIncome, fuel, registration, insurance, maintenance,
    loanInterest, medicareRate = 0.02 } = inputs;
  for (const [name, value] of Object.entries({
    businessKm, totalAnnualKm, taxableIncome, fuel, registration, insurance, maintenance, loanInterest,
  })) {
    validateAmount(name, value);
  }
  if (businessKm > totalAnnualKm) {
    throw new RangeError('Work-related kilometres cannot exceed total annual kilometres.');
  }
  if (medicareRate !== 0 && medicareRate !== 0.02) throw new RangeError('Choose a Medicare levy assumption.');

  const runningCosts = fuel + registration + insurance + maintenance + loanInterest;
  const annualDepreciation = depreciation(inputs);
  const annualCosts = runningCosts + annualDepreciation;
  const businessUsePct = totalAnnualKm === 0 ? 0 : businessKm / totalAnnualKm;
  const centsPerKmDeduction = Math.min(businessKm, KM_CAP) * CAR_RATE;
  const logbookDeduction = annualCosts * businessUsePct;
  const difference = logbookDeduction - centsPerKmDeduction;
  const winningMethod = Math.abs(difference) < 1e-9 ? 'tie' : difference > 0 ? 'logbook' : 'cents';

  const incomeWithCents = Math.max(0, taxableIncome - centsPerKmDeduction);
  const incomeWithLogbook = Math.max(0, taxableIncome - logbookDeduction);
  const taxDifference = residentIncomeTax(incomeWithCents) - residentIncomeTax(incomeWithLogbook)
    + (incomeWithCents - incomeWithLogbook) * medicareRate;

  return {
    businessUsePct, runningCosts, annualDepreciation, centsPerKmDeduction, logbookDeduction, winningMethod,
    extraDeduction: winningMethod === 'tie' ? 0 : Math.abs(difference),
    cashTaxDifference: winningMethod === 'tie' ? 0 : Math.abs(taxDifference),
    breakEven: findBreakEven(totalAnnualKm, annualCosts),
  };
}
