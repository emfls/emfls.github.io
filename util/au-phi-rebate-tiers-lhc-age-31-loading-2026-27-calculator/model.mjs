const TIER_LIMITS = {
  single: [105000, 123000, 164000],
  family: [210000, 246000, 328000],
};

// Rates are in thousandths of a percentage point. Money is calculated in cents.
const REBATE_RATES = [
  [24118, 16079, 8038, 0],
  [28139, 20098, 12058, 0],
  [32158, 24118, 16079, 0],
];
const MLS_RATES = [0, 1000, 1250, 1500];
const MAX_AMOUNT = 100_000_000;

function wholeNumber(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

function premiumCents(value, label) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT || value !== cents / 100) {
    throw new RangeError(`${label} must be a non-negative amount with up to two decimal places.`);
  }
  return cents;
}

export function incomeTier(income, household, dependentChildren) {
  wholeNumber(income, 0, MAX_AMOUNT, 'Surcharge income');
  const isSingle = household === 'single';
  if (!isSingle && household !== 'couple' && household !== 'single-parent') {
    throw new RangeError('Choose a valid household type.');
  }
  wholeNumber(dependentChildren, household === 'single-parent' ? 1 : 0, isSingle ? 0 : 99, 'Dependent children');
  const adjustment = isSingle ? 0 : 1500 * Math.max(0, dependentChildren - 1);
  const limits = isSingle ? TIER_LIMITS.single : TIER_LIMITS.family;
  const tier = limits.findIndex(limit => income <= limit + adjustment);
  return tier === -1 ? 3 : tier;
}

/** joinAge is the adult's age on the 1 July before first joining hospital cover. */
export function lhcLoading(joinAge, coveredByBaseDay = false) {
  wholeNumber(joinAge, 0, 120, 'Joining reference age');
  return coveredByBaseDay ? 0 : Math.min(70, Math.max(0, (joinAge - 30) * 2));
}

export function calculate({
  household, dependentChildren, income, oldestAge, joinAge1, joinAge2,
  byBaseDay1 = false, byBaseDay2 = false, hospital, extras,
}) {
  const tier = incomeTier(income, household, dependentChildren);
  wholeNumber(oldestAge, 18, 120, 'Oldest insured age');

  const hospitalCents = premiumCents(hospital, 'Hospital premium');
  const extrasCents = premiumCents(extras, 'Extras premium');
  const ageBand = oldestAge < 65 ? 0 : oldestAge < 70 ? 1 : 2;
  const rebateRate = REBATE_RATES[ageBand][tier];
  const rebateCents = Math.round((hospitalCents + extrasCents) * rebateRate / 100000);

  let loadingRate = 0;
  if (hospitalCents > 0) {
    const first = lhcLoading(wholeNumber(joinAge1, 0, oldestAge, 'Adult 1 joining reference age'), byBaseDay1);
    loadingRate = first;
    if (household === 'couple') {
      const second = lhcLoading(wholeNumber(joinAge2, 0, oldestAge, 'Adult 2 joining reference age'), byBaseDay2);
      loadingRate = (first + second) / 2;
    }
  }
  const loadingCents = Math.round(hospitalCents * loadingRate / 100);
  const netAnnualCents = hospitalCents + extrasCents + loadingCents - rebateCents;

  // Full-year comparison approximates the MLS calculation base with the supplied income.
  const mlsRate = MLS_RATES[tier];
  const mlsWithoutCoverCents = Math.round(income * mlsRate / 1000);
  const mlsAvoidedCents = hospitalCents > 0 ? mlsWithoutCoverCents : 0;

  return {
    tier,
    rebateRate: rebateRate / 1000,
    rebate: rebateCents / 100,
    loadingRate,
    loadingCost: loadingCents / 100,
    tenYearLoadingCost: loadingCents * 10 / 100,
    postLoadingRate: 0,
    netAnnual: netAnnualCents / 100,
    netMonthly: Math.round(netAnnualCents / 12) / 100,
    mlsRate: mlsRate / 1000,
    mlsWithoutCover: mlsWithoutCoverCents / 100,
    mlsAvoided: mlsAvoidedCents / 100,
    netVsMls: (netAnnualCents - mlsAvoidedCents) / 100,
  };
}
