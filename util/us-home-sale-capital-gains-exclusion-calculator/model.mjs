const MAX_CENTS = 100_000_000_000;
const BPS = 10_000;
const rateOf = (amount, rate) => Math.floor((amount * rate + BPS / 2) / BPS);

export function parseCents(value) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (match) {
    const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
    if (amount <= MAX_CENTS) return amount;
  }
  throw new RangeError('Enter an amount from 0 to 1 billion with up to two decimal places and no commas.');
}

function checkAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS) {
    throw new RangeError('Money inputs must be whole cents within the supported range.');
  }
}

const RATES = [1000, 1200, 2200, 2400, 3200, 3500, 3700];
const FILERS = {
  single: {exclusion: 250000, zero: 49450, upper: 545500, niit: 200000,
    ordinary: [12400, 50400, 105700, 201775, 256225, 640600]},
  joint: {exclusion: 500000, zero: 98900, upper: 613700, niit: 250000,
    ordinary: [24800, 100800, 211400, 403550, 512450, 768700]},
  head: {exclusion: 250000, zero: 66200, upper: 579600, niit: 200000,
    ordinary: [17700, 67450, 105700, 201750, 256200, 640600]},
  separate: {exclusion: 250000, zero: 49450, upper: 306850, niit: 125000,
    ordinary: [12400, 50400, 105700, 201775, 256225, 384350]},
};

function ordinaryTax(before, added, ceilings) {
  const after = before + added;
  let floor = 0;
  let taxUnits = 0;
  for (let i = 0; i < RATES.length; i += 1) {
    const ceiling = i < ceilings.length ? ceilings[i] * 100 : after;
    const slice = Math.max(0, Math.min(after, ceiling) - Math.max(before, floor));
    taxUnits += slice * RATES[i];
    floor = ceiling;
  }
  return Math.floor((taxUnits + BPS / 2) / BPS);
}

export function calculateSale({
  sale, selling, purchase, buying, improvements, depreciation, ordinary, magi, status, qualifies, longTerm, nonqualified = 0,
}) {
  for (const amount of [sale, selling, purchase, buying, improvements, depreciation, ordinary, magi, nonqualified]) checkAmount(amount);
  if (!Object.hasOwn(FILERS, status)) throw new RangeError('Choose a filing status.');
  if (qualifies && !longTerm) throw new RangeError('The full exclusion requires a holding period of more than one year.');
  const basisBeforeDepreciation = purchase + buying + improvements;
  if (depreciation > basisBeforeDepreciation) throw new RangeError('Depreciation cannot exceed the basis before depreciation.');
  const filer = FILERS[status];
  const adjustedBasis = basisBeforeDepreciation - depreciation;
  const amountRealized = sale - selling;
  const gain = amountRealized - adjustedBasis;
  const positiveGain = Math.max(0, gain);
  const depreciationGain = Math.min(positiveGain, depreciation);
  const exclusionLimit = qualifies ? filer.exclusion * 100 : 0;
  if (nonqualified > positiveGain - depreciationGain) {
    throw new RangeError('Nonqualified-use gain cannot exceed the gain remaining after depreciation.');
  }
  const excluded = Math.min(exclusionLimit, positiveGain - depreciationGain - nonqualified);
  const taxableGain = positiveGain - excluded;
  const section1250 = longTerm ? depreciationGain : 0;
  const taxableLtcg = longTerm ? taxableGain - section1250 : 0;
  const taxableShortTerm = longTerm ? 0 : taxableGain;

  // Schedule D worksheet ordering in a sale-only case with no other preferential income.
  const zeroRoom = Math.max(0, filer.zero * 100 - ordinary - section1250);
  const atZero = Math.min(taxableLtcg, zeroRoom);
  const depreciationAtOrdinary = Math.min(section1250, Math.max(0, filer.ordinary[3] * 100 - ordinary));
  const stackFor15 = ordinary + depreciationAtOrdinary + atZero;
  const atFifteen = Math.min(taxableLtcg - atZero, Math.max(0, filer.upper * 100 - stackFor15));
  const atTwenty = taxableLtcg - atZero - atFifteen;
  const taxRegular = Math.floor((atFifteen * 1500 + atTwenty * 2000 + BPS / 2) / BPS);
  const tax1250 = ordinaryTax(ordinary, depreciationAtOrdinary, filer.ordinary)
    + rateOf(section1250 - depreciationAtOrdinary, 2500);
  const taxShortTerm = ordinaryTax(ordinary, taxableShortTerm, filer.ordinary);
  // The worksheet also limits the total tax to tax at ordinary rates.
  const ordinaryRateReduction = longTerm
    ? Math.max(0, taxRegular + tax1250 - ordinaryTax(ordinary, taxableGain, filer.ordinary))
    : 0;
  const niit = rateOf(Math.min(taxableGain, Math.max(0, magi + taxableGain - filer.niit * 100)), 380);
  return {
    adjustedBasis, amountRealized, gain, exclusionLimit, excluded, section1250, taxableGain, taxableLtcg,
    taxableShortTerm, ordinaryRateReduction, bands: [atZero, atFifteen, atTwenty], taxRegular, tax1250, taxShortTerm, niit,
    totalTax: taxRegular + tax1250 + taxShortTerm - ordinaryRateReduction + niit,
  };
}
