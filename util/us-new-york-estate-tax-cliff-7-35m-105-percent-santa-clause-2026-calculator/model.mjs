export const MAX_AMOUNT = 2_000_000_000;
const DOLLAR = 100;
const RATE_SCALE = 10_000;
const MAX_CENTS = MAX_AMOUNT * DOLLAR;
const YEARS = {
  2025: { exclusion: 7_160_000, federalExclusion: 13_990_000 },
  2026: { exclusion: 7_350_000, federalExclusion: 15_000_000 }
};

// Each band gives its lower bound, base tax and marginal rate in basis points.
const BRACKETS = [
  [0, 0, 306],
  [500_000, 15_300, 500],
  [1_000_000, 40_300, 550],
  [1_500_000, 67_800, 650],
  [2_100_000, 106_800, 800],
  [2_600_000, 146_800, 880],
  [3_100_000, 190_800, 960],
  [3_600_000, 238_800, 1_040],
  [4_100_000, 290_800, 1_120],
  [5_100_000, 402_800, 1_200],
  [6_100_000, 522_800, 1_280],
  [7_100_000, 650_800, 1_360],
  [8_100_000, 786_800, 1_440],
  [9_100_000, 930_800, 1_520],
  [10_100_000, 1_082_800, 1_600],
].map(([lower, base, rate]) => ({ lower: lower * DOLLAR, base: base * DOLLAR, rate }));

function cents(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT || Math.round(amount * DOLLAR) / DOLLAR !== amount) {
    throw new RangeError('Enter a nonnegative amount in dollars and cents, up to $2 billion.');
  }
  return Math.round(amount * DOLLAR);
}

function band(amount) {
  return BRACKETS.findLast(({ lower }) => amount >= lower);
}

// Keep each tax in integer ten-thousandths of a cent until display rounding.
function taxUnits(amount) {
  const { lower, base, rate } = band(amount);
  return base * RATE_SCALE + (amount - lower) * rate;
}

const roundTax = units => Math.round(units / RATE_SCALE);
const dollars = amount => amount / DOLLAR;

export function tentativeTax(amount) {
  return dollars(roundTax(taxUnits(cents(amount))));
}

export function getParameters(year = 2026) {
  if (year !== 2025 && year !== 2026) throw new RangeError('Select 2025 or 2026.');
  const { exclusion, federalExclusion } = YEARS[year];
  const exclusionCents = exclusion * DOLLAR;
  const cliff = exclusion * 105 / 100;

  // Above the cliff, solve estate - exclusion = tentative tax in each band.
  for (const { lower, base, rate } of BRACKETS) {
    const root = lower + (exclusionCents - lower + base) * RATE_SCALE / (RATE_SCALE - rate);
    if (root > cliff * DOLLAR && band(root).lower === lower) {
      return { exclusion, cliff, federalExclusion, breakEven: dollars(Math.round(root)) };
    }
  }
  throw new Error('No above-cliff break-even in the statutory tax schedule.');
}

function assess(estate, exclusion, cliff) {
  const tentative = taxUnits(estate);
  if (estate <= exclusion) return { tentative, credit: tentative, zone: 'EXEMPT' };
  if (estate <= cliff) {
    // § 952(c)(1): the exclusion is 20 times the phase-out interval.
    const credit = taxUnits((cliff - estate) * 20);
    return { tentative, credit, zone: 'PHASE_OUT_CLIFF_TRAP' };
  }
  return { tentative, credit: 0, zone: 'CLIFF_LOST_ALL_CREDIT' };
}

export function calculateEstate({ taxableEstate, includibleGifts = 0, year = 2026 }) {
  const parameters = getParameters(year);
  const estateAssets = cents(taxableEstate);
  const gifts = cents(includibleGifts);
  const estate = estateAssets + gifts;
  if (estate > MAX_CENTS) throw new RangeError('The combined New York taxable estate must be $2 billion or less.');

  const exclusion = parameters.exclusion * DOLLAR;
  const cliff = parameters.cliff * DOLLAR;
  const { tentative, credit, zone } = assess(estate, exclusion, cliff);
  const tax = roundTax(tentative - credit);
  const withoutGifts = assess(estateAssets, exclusion, cliff);
  const excess = Math.max(0, estate - exclusion);
  const santaFeasible = excess <= estateAssets;
  const net = estateAssets - tax;
  const netWithSanta = santaFeasible ? estateAssets - excess : null;
  const gain = santaFeasible ? netWithSanta - net : null;

  let marginalBasisPoints = 0;
  if (estate >= exclusion) marginalBasisPoints = band(estate).rate;
  if (estate >= exclusion && estate < cliff) {
    // The credit base decreases as the estate grows, so read its left-hand rate.
    marginalBasisPoints += 20 * band((cliff - estate) * 20 - 1).rate;
  }

  return {
    ...parameters,
    nyTaxableEstate: dollars(estate),
    zone,
    tentativeTax: dollars(roundTax(tentative)),
    applicableCredit: dollars(roundTax(credit)),
    creditLost: estate > exclusion ? dollars(roundTax(taxUnits(exclusion) - credit)) : 0,
    nyEstateTax: dollars(tax),
    giftTaxImpact: dollars(tax - roundTax(withoutGifts.tentative - withoutGifts.credit)),
    excessTaxRate: excess > 0 ? (tentative - credit) / (excess * RATE_SCALE) * 100 : null,
    marginalRate: marginalBasisPoints / 100,
    santaDonation: dollars(excess),
    santaFeasible,
    heirsNetWithoutSanta: dollars(net),
    heirsNetWithSanta: santaFeasible ? dollars(netWithSanta) : null,
    heirsNetGain: santaFeasible ? dollars(gain) : null,
    optimalDonation: santaFeasible ? dollars(gain > 0 ? excess : 0) : null,
  };
}
