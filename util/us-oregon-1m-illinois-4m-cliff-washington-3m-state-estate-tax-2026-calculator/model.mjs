export const OREGON_THRESHOLD = 1_000_000;
export const ILLINOIS_THRESHOLD = 4_000_000;
export const FEDERAL_EXCLUSION = 15_000_000;
export const MAX_MONEY = 100_000_000_000;

// Rows contain the lower bound, base tax and marginal rate.
const OREGON = [
  [0, 0, 0],
  [OREGON_THRESHOLD, 0, .10],
  [1_500_000, 50_000, .1025],
  [2_500_000, 152_500, .105],
  [3_500_000, 257_500, .11],
  [4_500_000, 367_500, .115],
  [5_500_000, 482_500, .12],
  [6_500_000, 602_500, .13],
  [7_500_000, 732_500, .14],
  [8_500_000, 872_500, .15],
  [9_500_000, 1_022_500, .16],
];

const ILLINOIS_CREDIT = [
  [0, 0, 0],
  [40_000, 0, .008],
  [90_000, 400, .016],
  [140_000, 1_200, .024],
  [240_000, 3_600, .032],
  [440_000, 10_000, .04],
  [640_000, 18_000, .048],
  [840_000, 27_600, .056],
  [1_040_000, 38_800, .064],
  [1_540_000, 70_800, .072],
  [2_040_000, 106_800, .08],
  [2_540_000, 146_800, .088],
  [3_040_000, 190_800, .096],
  [3_540_000, 238_800, .104],
  [4_040_000, 290_800, .112],
  [5_040_000, 402_800, .12],
  [6_040_000, 522_800, .128],
  [7_040_000, 650_800, .136],
  [8_040_000, 786_800, .144],
  [9_040_000, 930_800, .152],
  [10_040_000, 1_082_800, .16],
];

const WASHINGTON = {
  early: {
    exclusion: 3_076_000,
    schedule: [
      [0, 0, .10],
      [1_000_000, 100_000, .15],
      [2_000_000, 250_000, .17],
      [3_000_000, 420_000, .19],
      [4_000_000, 610_000, .23],
      [6_000_000, 1_070_000, .26],
      [7_000_000, 1_330_000, .30],
      [9_000_000, 1_930_000, .35],
    ],
  },
  late: {
    exclusion: 3_000_000,
    schedule: [
      [0, 0, .10],
      [1_000_000, 100_000, .14],
      [2_000_000, 240_000, .15],
      [3_000_000, 390_000, .16],
      [4_000_000, 550_000, .18],
      [6_000_000, 910_000, .19],
      [7_000_000, 1_100_000, .195],
      [9_000_000, 1_490_000, .20],
    ],
  },
};

const cents = dollars => Math.round(dollars * 100);
const dollars = cents => cents / 100;
function roundMoney(value) {
  const scaled = value * 100;
  return dollars(Math.round(scaled + scaled * Number.EPSILON));
}

function moneyCents(value) {
  const amount = cents(value);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY || value !== dollars(amount)) {
    throw new RangeError('Enter a nonnegative dollar amount with at most two decimals.');
  }
  return amount;
}

function tableTax(amount, schedule) {
  const [lower, base, rate] = schedule.findLast(([lower]) => amount >= lower);
  return base + rate * dollars(cents(amount) - cents(lower));
}

export function oregonTax(estate) {
  return roundMoney(tableTax(dollars(moneyCents(estate)), OREGON));
}

function washingtonParameters(period) {
  if (period !== 'early' && period !== 'late') {
    throw new RangeError('Choose a 2026 Washington date of death period.');
  }
  return WASHINGTON[period];
}

export function washingtonTax(estate, period = 'late') {
  const { exclusion, schedule } = washingtonParameters(period);
  const taxable = dollars(Math.max(0, moneyCents(estate) - cents(exclusion)));
  return roundMoney(tableTax(taxable, schedule));
}

export function illinoisCredit(estate) {
  const adjustedBeforeTax = dollars(moneyCents(estate) - cents(60_000));
  if (adjustedBeforeTax <= 0) return 0;

  // A bracket beginning at L after deduction begins at L + base tax before deduction.
  const [lower, base, rate] = ILLINOIS_CREDIT.findLast(
    ([lower, base]) => adjustedBeforeTax >= lower + base,
  );
  return (base + rate * (adjustedBeforeTax - lower)) / (1 + rate);
}

export function illinoisTax(estate, adjustedGifts = 0, illinoisShare = 1) {
  const total = moneyCents(estate) + moneyCents(adjustedGifts);
  if (!Number.isFinite(illinoisShare) || illinoisShare < 0 || illinoisShare > 1) {
    throw new RangeError('Illinois apportionment must be between 0% and 100%.');
  }
  const excess = dollars(Math.max(0, total - cents(ILLINOIS_THRESHOLD)));
  // Solve T = 40% × (Line 5 − $4M − T), then apply the lower result before apportionment.
  const exclusionLimit = excess * 2 / 7;
  return roundMoney(Math.min(illinoisCredit(estate), exclusionLimit) * illinoisShare);
}

export function compareEstates({
  estate, adjustedGifts = 0, illinoisShare = 1, washingtonPeriod = 'late', firstSpouseAssets = 0,
}) {
  const estateCents = moneyCents(estate);
  const giftCents = moneyCents(adjustedGifts);
  const firstSpouseCents = Math.min(moneyCents(firstSpouseAssets), estateCents);
  const { exclusion: washingtonExclusion } = washingtonParameters(washingtonPeriod);
  const states = [
    ['OR', OREGON_THRESHOLD, oregonTax],
    ['IL', ILLINOIS_THRESHOLD, amount => illinoisTax(amount, adjustedGifts, illinoisShare)],
    ['WA', washingtonExclusion, amount => washingtonTax(amount, washingtonPeriod)],
  ].map(([state, exclusion, taxOn]) => {
    const trustFundingCents = Math.min(firstSpouseCents, cents(exclusion));
    const tax = taxOn(estate);
    const withTrust = taxOn(dollars(estateCents - trustFundingCents));
    return {
      state, tax, effectiveRate: estate ? tax / estate : 0,
      trustFunding: dollars(trustFundingCents), withTrust,
      trustSavings: dollars(cents(tax) - cents(withTrust)),
    };
  });

  const combined = estateCents + giftCents;
  const excess = combined - cents(ILLINOIS_THRESHOLD);
  return {
    states,
    washingtonExclusion,
    illinois: {
      combined: dollars(combined),
      aboveThreshold: excess > 0,
      reductionToThreshold: excess >= 0 && giftCents <= cents(ILLINOIS_THRESHOLD)
        ? dollars(excess) : null,
      reductionStrictlyBelow: excess >= 0 && giftCents < cents(ILLINOIS_THRESHOLD)
        ? dollars(excess + 1) : null,
    },
    federal: {
      combined: dollars(combined),
      difference: dollars(combined - cents(FEDERAL_EXCLUSION)),
    },
  };
}
