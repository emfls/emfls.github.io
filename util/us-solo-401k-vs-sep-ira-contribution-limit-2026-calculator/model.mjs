export const LIMITS = Object.freeze({
  annualAdditions: 72000,
  electiveDeferral: 24500,
  regularCatchUp: 8000,
  enhancedCatchUp: 11250,
  compensation: 360000,
  socialSecurityWageBase: 184500,
  rothCatchUpWages: 150000
});

export function catchUpLimit(age) {
  if (age < 50) return 0;
  if (age >= 60 && age <= 63) return LIMITS.enhancedCatchUp;
  return LIMITS.regularCatchUp;
}

const maxInputDollars = 1_000_000_000;
const nonnegative = amount => Math.max(0, amount);
// Round contribution limits down to cents. The tolerance absorbs binary representation error.
const floorCents = amount => Math.floor(amount * 100 + 1e-7);
const dollars = cents => cents / 100;

function checkRange(value, name, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum.toLocaleString('en-US')} and ${maximum.toLocaleString('en-US')}.`);
  }
}

function taxSavings(deductibleCents, federalRate, stateRate) {
  const federal = Math.round(deductibleCents * federalRate / 100);
  const state = Math.round(deductibleCents * stateRate / 100);
  return { federal: dollars(federal), state: dollars(state), total: dollars(federal + state) };
}

/** All monetary inputs are in dollars and marginal rates are in percentage points. */
export function calculateContributions({
  entity = 'sole-proprietor',
  netScheduleC = 0,
  w2Salary = 0,
  otherW2Wages = 0,
  other401kDeferral = 0,
  otherCatchUp = 0,
  age = 0,
  priorSponsorWages = 0,
  catchUpMode = 'roth-supported',
  federalRate = 0,
  stateRate = 0
} = {}) {
  if (!['sole-proprietor', 'corporation'].includes(entity)) throw new RangeError('Choose a supported entity.');
  if (!['roth-supported', 'pre-tax-only', 'none'].includes(catchUpMode)) {
    throw new RangeError('Choose a supported catch-up plan option.');
  }
  checkRange(age, 'Year-end age', 0, 120);
  if (!Number.isInteger(age)) throw new RangeError('Year-end age must be a whole number.');
  checkRange(other401kDeferral, 'Outside regular deferrals', 0, maxInputDollars);
  checkRange(otherCatchUp, 'Outside catch-up contributions', 0, maxInputDollars);
  checkRange(federalRate, 'Federal marginal rate', 0, 100);
  checkRange(stateRate, 'State marginal rate', 0, 100);

  const isSole = entity === 'sole-proprietor';
  let seTaxBase = 0;
  let seTax = 0;
  let adjustedNetSE = 0;
  let compensation;
  let employerLimit;
  if (isSole) {
    checkRange(netScheduleC, 'Schedule C net profit', -maxInputDollars, maxInputDollars);
    checkRange(otherW2Wages, 'Other Social Security wages', 0, maxInputDollars);
    seTaxBase = 0.9235 * nonnegative(netScheduleC);
    if (seTaxBase >= 400) {
      const availableWageBase = nonnegative(LIMITS.socialSecurityWageBase - otherW2Wages);
      seTax = 0.124 * Math.min(seTaxBase, availableWageBase) + 0.029 * seTaxBase;
    }
    adjustedNetSE = nonnegative(netScheduleC - 0.5 * seTax);
    compensation = adjustedNetSE;
    employerLimit = Math.min(0.2 * adjustedNetSE, 0.25 * LIMITS.compensation);
  } else {
    checkRange(w2Salary, 'Eligible W-2 wages', 0, maxInputDollars);
    checkRange(priorSponsorWages, 'Prior-year sponsor FICA wages', 0, maxInputDollars);
    compensation = Math.min(w2Salary, LIMITS.compensation);
    employerLimit = 0.25 * compensation;
  }

  const sep = floorCents(Math.min(LIMITS.annualAdditions, employerLimit));
  const regularRoom = nonnegative(LIMITS.electiveDeferral - other401kDeferral);
  const employee = floorCents(Math.min(regularRoom, compensation));
  const compensationAfterDeferrals = nonnegative(compensation - dollars(employee));
  // Pub. 560 deduction worksheet: for a sole proprietor, earned income is reduced
  // by the employer contribution itself. The employer addition therefore fits twice
  // in the part of adjusted net earnings left after regular elective deferrals.
  const employer = floorCents(Math.min(
    employerLimit,
    LIMITS.annualAdditions - dollars(employee),
    isSole ? compensationAfterDeferrals / 2 : compensationAfterDeferrals
  ));
  const eligibleComp = isSole
    ? Math.min(LIMITS.compensation, nonnegative(compensation - dollars(employer)))
    : compensation;
  const annualAdditionsLimit = floorCents(Math.min(LIMITS.annualAdditions, eligibleComp));

  const ageLimit = catchUpLimit(age);
  const rothCatchUp = ageLimit > 0 && !isSole && priorSponsorWages > LIMITS.rothCatchUpWages;
  const canCatchUp = catchUpMode !== 'none' && (!rothCatchUp || catchUpMode === 'roth-supported');
  const availableCatchUp = canCatchUp ? nonnegative(ageLimit - otherCatchUp) : 0;
  const catchUp = Math.min(
    floorCents(availableCatchUp),
    nonnegative(floorCents(eligibleComp) - employee)
  );
  const solo = employee + employer + catchUp;
  const afterTax = nonnegative(annualAdditionsLimit - employee - employer);

  return {
    seTaxBase,
    seTax,
    adjustedNetSE,
    eligibleComp,
    annualAdditionsLimit: dollars(annualAdditionsLimit),
    employeeDeferral: dollars(employee),
    employerContribution: dollars(employer),
    catchUp: dollars(catchUp),
    rothCatchUp,
    soloMax: dollars(solo),
    sepMax: dollars(sep),
    extraRoom: dollars(solo - sep),
    afterTaxRoom: dollars(afterTax),
    soloMaxWithAfterTax: dollars(solo + afterTax),
    soloTaxSavings: taxSavings(solo - (rothCatchUp ? catchUp : 0), federalRate, stateRate),
    sepTaxSavings: taxSavings(sep, federalRate, stateRate)
  };
}
