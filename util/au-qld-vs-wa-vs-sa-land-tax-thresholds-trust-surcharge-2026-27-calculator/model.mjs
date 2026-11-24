// Each band lists the breakpoint, base tax in cents and marginal rate in basis points.
const QLD_INDIVIDUAL = [
  [600_000, 50_000, 100],
  [1_000_000, 450_000, 165],
  [3_000_000, 3_750_000, 125],
  [5_000_000, 6_250_000, 175],
  [10_000_000, 15_000_000, 225],
];
const QLD_ENTITY_LOWER = [
  [350_000, 145_000, 170],
  [2_250_000, 3_375_000, 150],
];
const QLD_ENTITY = [
  ...QLD_ENTITY_LOWER,
  [5_000_000, 7_500_000, 225],
  [10_000_000, 18_750_000, 275],
];
const QLD_ABSENTEE = [
  ...QLD_ENTITY_LOWER,
  [5_000_000, 7_500_000, 200],
  [10_000_000, 17_500_000, 250],
];
const WA_GENERAL = [
  [300_000, 30_000, 0],
  [420_000, 30_000, 25],
  [1_000_000, 175_000, 90],
  [1_800_000, 895_000, 180],
  [5_000_000, 6_655_000, 200],
  [11_000_000, 18_655_000, 267],
];
const SA_GENERAL = [
  [936_000, 0, 50],
  [1_504_000, 284_000, 100],
  [2_188_000, 968_000, 200],
  [3_504_000, 3_600_000, 240],
];
const SA_TRUST = [
  [25_000, 12_500, 50],
  [936_000, 468_000, 100],
  [1_504_000, 1_036_000, 150],
  [2_188_000, 2_062_000, 240],
  [3_504_000, 5_220_400, 240],
];

const STATES = ['QLD', 'WA', 'SA'];
export const OWNER_TYPES = Object.freeze(['individual', 'company', 'trust', 'absentee', 'foreignCompany', 'foreignTrust']);
// Keep the product of the land value and highest marginal rate exact before cent rounding.
export const MAX_TAXABLE_VALUE = Math.floor(Number.MAX_SAFE_INTEGER / 275);

function assess(state, value, owner) {
  let base = 0;
  let surcharge = 0;
  if (state === 'QLD') {
    let scale = QLD_ENTITY;
    if (owner === 'individual') scale = QLD_INDIVIDUAL;
    if (owner === 'absentee') scale = QLD_ABSENTEE;

    const band = scale.findLast(([threshold]) => value >= threshold);
    if (band) {
      const [threshold, fixed, rate] = band;
      base = fixed + Math.round((value - threshold) * rate / 100);
    }
    if (owner === 'absentee' || owner === 'foreignCompany' || owner === 'foreignTrust') {
      surcharge = Math.max(0, value - 350_000) * 3;
    }
  } else if (state === 'WA') {
    const band = WA_GENERAL.findLast(([threshold]) => value > threshold);
    if (band) {
      const [threshold, fixed, rate] = band;
      base = fixed + Math.round((value - threshold) * rate / 100);
    }
  } else {
    const scale = owner === 'trust' || owner === 'foreignTrust' ? SA_TRUST : SA_GENERAL;
    const band = scale.findLast(([threshold]) => value > threshold);
    if (band) {
      const [threshold, fixed, rate] = band;
      // RevenueSA charges for each $100 or part of $100. Section 6 waives tax below $20.
      base = fixed + Math.ceil((value - threshold) / 100) * rate;
      if (base < 2_000) base = 0;
    }
  }
  return { base, surcharge, total: base + surcharge };
}

function validate(value, owner) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_TAXABLE_VALUE) {
    throw new RangeError('Taxable land value is outside the supported whole-dollar range.');
  }
  if (!OWNER_TYPES.includes(owner)) throw new RangeError('Unsupported ownership type.');
}

function inDollars({ base, surcharge, total }) {
  return { base: base / 100, surcharge: surcharge / 100, total: total / 100 };
}

/** Estimate annual land tax in AUD for one state and ownership scenario. */
export function landTax(state, value, owner) {
  validate(value, owner);
  if (!STATES.includes(state)) throw new RangeError('Unsupported state.');
  return inDollars(assess(state, value, owner));
}

/** Compare the same taxable value under all three state schedules. */
export function compareLandTax(value, owner) {
  validate(value, owner);
  const assessments = OWNER_TYPES.map((type) => ({
    owner: type,
    taxes: Object.fromEntries(STATES.map((state) => [state, assess(state, value, type)])),
  }));
  const baseline = assessments[0].taxes;
  const selected = assessments.find((scenario) => scenario.owner === owner).taxes;
  const sorted = STATES.map((state) => ({ state, ...selected[state] }))
    .sort((first, second) => first.total - second.total);
  const spread = sorted.at(-1).total - sorted[0].total;

  return {
    ranking: sorted.map((entry) => ({
      state: entry.state,
      ...inDollars(entry),
      rank: sorted.findIndex((other) => other.total === entry.total) + 1,
      tenYear: entry.total / 10,
    })),
    annualSpread: spread / 100,
    tenYearSpread: spread / 10,
    ownership: assessments.map(({ owner: type, taxes }) => ({
      owner: type,
      taxes: Object.fromEntries(STATES.map((state) => [state, inDollars(taxes[state])])),
      deltas: Object.fromEntries(STATES.map((state) => [state, (taxes[state].total - baseline[state].total) / 100])),
    })),
  };
}
