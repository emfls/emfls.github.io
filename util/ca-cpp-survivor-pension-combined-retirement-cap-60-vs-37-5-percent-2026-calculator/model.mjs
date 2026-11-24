export const CPP_2026 = Object.freeze({
  flatUnder65: 238.17,
  rateUnder65: 0.375,
  rate65Plus: 0.60,
  maximumUnder65: 803.54,
  maximum65Plus: 904.59,
  retirementMaximumAt65: 1507.65,
  combinedReferenceAt65: 1531.56,
  deathBenefit: 2500,
  deathTopUp: 2500,
});

export const CLAIM_AGES = Object.freeze([60, 65, 70]);
const AGE_FACTORS = Object.freeze({ 60: 0.64, 65: 1, 70: 1.42 });
const cents = (amount) => Math.round((amount + Number.EPSILON * amount) * 100);
const dollars = (amountInCents) => amountInCents / 100;

function validateAge(name, age, min, max) {
  if (!Number.isInteger(age) || age < min || age > max) {
    throw new RangeError(`${name} must be a whole number from ${min} to ${max}.`);
  }
}

function validatePension(name, amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > CPP_2026.retirementMaximumAt65) {
    throw new RangeError(`${name} must be between 0 and 1507.65 CAD.`);
  }
}

export function standaloneSurvivor(age, deceasedAt65) {
  validateAge('Survivor age', age, 18, 120);
  validatePension('Deceased CPP', deceasedAt65);
  const { flatUnder65, rateUnder65, rate65Plus, maximumUnder65, maximum65Plus } = CPP_2026;
  const amount = age < 65
    ? Math.min(maximumUnder65, flatUnder65 + deceasedAt65 * rateUnder65)
    : Math.min(maximum65Plus, deceasedAt65 * rate65Plus);
  return dollars(cents(amount));
}

// This ceiling models the requested what-if. Sections 46 and 58 use
// pension components and contribution/index data for a real combined award.
export function monthlyCapScenario({ age, deceasedAt65, ownAt65, claimAge }) {
  validatePension('Your CPP', ownAt65);
  if (!CLAIM_AGES.includes(claimAge)) throw new RangeError('Choose claim age 60, 65 or 70.');

  const survivor = cents(standaloneSurvivor(age, deceasedAt65));
  const own = age >= claimAge ? cents(ownAt65 * AGE_FACTORS[claimAge]) : 0;
  const uncapped = own + survivor;
  const deferralIncrease = claimAge === 70 && own > 0 ? own - cents(ownAt65) : 0;
  const cap = cents(CPP_2026.combinedReferenceAt65) + deferralIncrease;
  const combined = own > 0 ? Math.min(cap, uncapped) : uncapped;
  const reduction = uncapped - combined;

  return {
    ownMonthly: dollars(own),
    survivorMonthly: dollars(survivor),
    uncappedMonthly: dollars(uncapped),
    capMonthly: own > 0 ? dollars(cap) : null,
    combinedMonthly: dollars(combined),
    reductionMonthly: dollars(reduction),
    reductionAnnual: dollars(reduction * 12),
  };
}

export function compareClaimAges({ currentAge, endAge, deceasedAt65, ownAt65 }) {
  validateAge('Current age', currentAge, 18, 119);
  validateAge('Projection end age', endAge, currentAge + 1, 120);
  const standaloneMonthly = standaloneSurvivor(currentAge, deceasedAt65);
  validatePension('Your CPP', ownAt65);

  const scenarios = CLAIM_AGES.filter((claimAge) => claimAge >= currentAge).map((claimAge) => {
    const monthlyAt = (age) => monthlyCapScenario({ age, deceasedAt65, ownAt65, claimAge });
    let total = 0;
    let uncapped = 0;
    let reductionFirst20Years = 0;
    const first20End = currentAge + 20;
    for (let age = currentAge; age < Math.max(endAge, first20End); age++) {
      // Age-band and claim events fall on birthdays in this projection.
      const monthly = monthlyAt(age);
      if (age < endAge) {
        total += cents(monthly.combinedMonthly) * 12;
        uncapped += cents(monthly.uncappedMonthly) * 12;
      }
      if (age < first20End) {
        reductionFirst20Years += cents(monthly.reductionMonthly) * 12;
      }
    }

    return {
      claimAge,
      firstClaimMonth: monthlyAt(claimAge),
      startsBeforeEnd: claimAge < endAge,
      cumulativeCombined: dollars(total),
      cumulativeReduction: dollars(uncapped - total),
      reductionFirst20Years: dollars(reductionFirst20Years),
    };
  });

  const highest = Math.max(...scenarios.map(({ cumulativeCombined }) => cumulativeCombined));
  const bestClaimAges = scenarios
    .filter(({ cumulativeCombined }) => cumulativeCombined === highest)
    .map(({ claimAge }) => claimAge);
  return { standaloneMonthly, scenarios, bestClaimAges };
}
