export const EARLY_TAX_RATE = 0.10;
export const PLAN_WITHHOLDING_RATE = 0.20;
export const MAX_AMOUNT = 100_000_000;
export const STANDARD_MIN_AGE = 50;
export const PUBLIC_SAFETY_MIN_AGE = 18;

const MONTHS_PER_YEAR = 12;
const PENALTY_FREE_AGE_MONTHS = 59.5 * MONTHS_PER_YEAR;

function validate(value, label, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${integer ? 'a whole number' : 'a number'} from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`);
  }
}

export function calculateBridge({
  currentBalance, outsideBalance, annualWithdrawal, ageInSeparationYear,
  birthdayOffsetMonths, publicSafety, planServiceYears, marginalTaxRate
}) {
  if (typeof publicSafety !== 'boolean') throw new TypeError('Select whether the public safety rule applies.');
  validate(currentBalance, 'Separating employer’s plan balance', 0, MAX_AMOUNT);
  validate(outsideBalance, 'Old plan or traditional IRA balance', 0, MAX_AMOUNT);
  validate(annualWithdrawal, 'Annual gross withdrawal', 0, MAX_AMOUNT);
  validate(ageInSeparationYear, 'Age in the separation year', publicSafety ? PUBLIC_SAFETY_MIN_AGE : STANDARD_MIN_AGE, 59, true);
  validate(birthdayOffsetMonths, 'Months from your birthday', -11, 11, true);
  validate(planServiceYears, 'Credited plan service', 0, 70);
  validate(marginalTaxRate, 'Combined marginal tax rate', 0, 100);

  const eligibility = publicSafety && planServiceYears >= 25 ? 'service'
    : ageInSeparationYear >= 55 ? 'age55'
    : publicSafety && ageInSeparationYear >= 50 ? 'age50'
    : 'ineligible';
  const eligible = eligibility !== 'ineligible';
  const bridgeMonths = Math.max(0, PENALTY_FREE_AGE_MONTHS
    - ageInSeparationYear * MONTHS_PER_YEAR - birthdayOffsetMonths);

  // Keep monetary allocations and scenario differences in cents.
  const toCents = amount => Math.round((amount + Number.EPSILON) * 100);
  const dollars = cents => cents / 100;
  const requested = Math.round(toCents(annualWithdrawal) * bridgeMonths / MONTHS_PER_YEAR);
  const current = Math.min(requested, toCents(currentBalance));
  const outside = Math.min(requested - current, toCents(outsideBalance));
  const funded = current + outside;
  const outsidePenalty = Math.round(outside * EARLY_TAX_RATE);
  const allEarlyPenalty = Math.round(funded * EARLY_TAX_RATE);
  const keepPenalty = eligible ? outsidePenalty : allEarlyPenalty;

  const withheld = Math.round(current * PLAN_WITHHOLDING_RATE);
  const estimatedPlanIncomeTax = Math.round(current * marginalTaxRate / 100);
  const estimatedIncomeTax = Math.round(funded * marginalTaxRate / 100);
  const rolloverPenalty = allEarlyPenalty;
  const consolidatedPenalty = eligible ? 0 : allEarlyPenalty;

  return {
    eligibility, eligible, bridgeMonths,
    requested: dollars(requested),
    currentWithdrawal: dollars(current),
    outsideWithdrawal: dollars(outside),
    fundedWithdrawal: dollars(funded),
    shortfall: dollars(requested - funded),
    keepPenalty: dollars(keepPenalty),
    rolloverPenalty: dollars(rolloverPenalty),
    consolidatedPenalty: dollars(consolidatedPenalty),
    penaltySaved: dollars(rolloverPenalty - keepPenalty),
    reverseRolloverSavings: dollars(keepPenalty - consolidatedPenalty),
    withheld: dollars(withheld),
    planCashAfterWithholding: dollars(current - withheld),
    estimatedPlanIncomeTax: dollars(estimatedPlanIncomeTax),
    estimatedIncomeTax: dollars(estimatedIncomeTax),
    withholdingDifference: dollars(withheld - estimatedPlanIncomeTax)
  };
}
