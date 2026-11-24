export const ANNUAL_CAP = 130_000;
const START_YEAR = 2026;
const MAX_MONEY = 1_000_000_000;

function moneyCents(value) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) {
    throw new RangeError('Enter a dollar amount between $0 and $1 billion.');
  }
  const cents = Math.round(value * 100);
  if (Math.abs(cents / 100 - value) > 1e-9) {
    throw new RangeError('Dollar amounts can have up to two decimal places.');
  }
  return cents;
}

export function capTier(tsb) {
  const cents = moneyCents(tsb);
  if (cents < 184_000_000) return { cap: 3 * ANNUAL_CAP, years: 3 };
  if (cents < 197_000_000) return { cap: 2 * ANNUAL_CAP, years: 2 };
  if (cents < 210_000_000) return { cap: ANNUAL_CAP, years: 1 };
  return { cap: 0, years: 0 };
}

export function deathBenefitTax({ taxed, untaxed }, beneficiary) {
  if (!Number.isFinite(taxed) || taxed < 0 || !Number.isFinite(untaxed) || untaxed < 0) {
    throw new RangeError('Taxable components must be non-negative dollar amounts.');
  }
  if (beneficiary === 'dependant') return { direct: 0, estate: 0, levy: 0 };
  if (beneficiary !== 'non-dependant') throw new RangeError('Choose a beneficiary type.');
  const estate = (15 * taxed + 30 * untaxed) / 100;
  const levy = (taxed + untaxed) * 2 / 100;
  return { direct: estate + levy, estate, levy };
}

function componentSplit(taxFree, taxable) {
  const total = taxFree + taxable;
  return {
    taxFree, taxable,
    taxFreePct: total ? taxFree / total * 100 : 0,
    taxablePct: total ? taxable / total * 100 : 0
  };
}

function eligibility(input, tier, room) {
  if (input.age < 60 || input.age >= 75) return 'age';
  if (input.age < 65 && !input.release) return 'release';
  if (tier.cap === 0) return 'no-cap';
  if (input.arrangement === 'unknown') return 'unknown-cap';
  if (input.arrangement === 'fresh' && input.otherContributions > ANNUAL_CAP) return 'cap-conflict';
  if (room <= 0) return 'no-cap';
  if (input.taxed + input.untaxed === 0) return 'no-taxable';
  if (input.target === 0) return 'no-target';
  if (input.untaxed > 0 && !input.untaxedFunding) return 'untaxed-funding';
  return 'eligible';
}

export function projectRecontribution(input) {
  const { taxFree, taxed, untaxed, tsb, age, release, beneficiary, target,
    arrangement, otherContributions, remainingCap, yearsToReset, untaxedFunding } = input;
  if (!Number.isInteger(age) || age < 0 || age > 120) throw new RangeError('Enter a whole age from 0 to 120.');
  if (typeof release !== 'boolean' || typeof untaxedFunding !== 'boolean') {
    throw new RangeError('Confirm whether the withdrawal conditions apply.');
  }
  if (!['fresh', 'active', 'unknown'].includes(arrangement)) throw new RangeError('Choose a cap status.');
  if (arrangement === 'active' && ![1, 2, 3].includes(yearsToReset)) {
    throw new RangeError('Select the first financial year after your active arrangement ends.');
  }

  const sourceCents = moneyCents(taxFree) + moneyCents(taxed) + moneyCents(untaxed);
  const targetCents = moneyCents(target);
  const tier = capTier(tsb);
  const annualCents = ANNUAL_CAP * 100;
  const tierCents = tier.cap * 100;
  const priorCents = arrangement === 'fresh' ? moneyCents(otherContributions) : 0;
  const activeCents = arrangement === 'active' ? moneyCents(remainingCap) : 0;
  if (activeCents > 3 * annualCents) throw new RangeError('Check the remaining cap in ATO online services.');
  const room = tierCents === 0 ? 0 : {
    fresh: Math.max(0, tierCents - priorCents), active: activeCents, unknown: null
  }[arrangement];

  const current = deathBenefitTax({ taxed, untaxed }, beneficiary);
  const initialSplit = componentSplit(taxFree, taxed + untaxed);
  const code = eligibility(input, tier, room);
  const cycles = [];
  const result = {
    current, initialSplit, tier, cycles, stop: null,
    gate: { code, available: room === null ? null : room / 100 }
  };
  if (code !== 'eligible') return result;

  let withdrawnCents = 0;
  let year = START_YEAR;
  for (let index = 0; index < 3; index += 1) {
    const cycleAge = age + year - START_YEAR;
    if (cycleAge >= 75) {
      result.stop = 'age';
      break;
    }
    if (withdrawnCents === sourceCents) {
      result.stop = 'depleted';
      break;
    }

    const withdrawalCents = Math.min(index === 0 ? room : tierCents, targetCents, sourceCents - withdrawnCents);
    withdrawnCents += withdrawalCents;
    // Removing each component in proportion preserves the original account's mix.
    // All recontributions are held separately, so later withdrawals use only that original mix.
    const sourceFraction = (sourceCents - withdrawnCents) / sourceCents;
    const removedFraction = withdrawnCents / sourceCents;
    const remaining = deathBenefitTax({ taxed: taxed * sourceFraction, untaxed: untaxed * sourceFraction }, beneficiary);
    const saved = deathBenefitTax({ taxed: taxed * removedFraction, untaxed: untaxed * removedFraction }, beneficiary);
    cycles.push({
      year, age: cycleAge, withdrawal: withdrawalCents / 100,
      converted: (taxed + untaxed) * (withdrawalCents / sourceCents),
      savedDirect: saved.direct, savedEstate: saved.estate, remaining,
      split: componentSplit(taxFree + (taxed + untaxed) * removedFraction, (taxed + untaxed) * sourceFraction)
    });

    if (index === 0 && arrangement === 'active') {
      year += yearsToReset;
    } else {
      const contributedCents = withdrawalCents + (index === 0 ? priorCents : 0);
      year += contributedCents > annualCents ? tier.years : 1;
    }
  }
  return result;
}
