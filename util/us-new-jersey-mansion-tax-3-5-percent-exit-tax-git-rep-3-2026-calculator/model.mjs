const MANSION_TIERS = [
  [1_000_000, 0],
  [2_000_000, 100],
  [2_500_000, 200],
  [3_000_000, 250],
  [3_500_000, 300],
  [Infinity, 350],
];

const STANDARD_RTF = [
  [150_000, 200],
  [200_000, 335],
  [350_000, 390],
];

const HIGH_VALUE_RTF = [
  [150_000, 290],
  [200_000, 425],
  [550_000, 480],
  [850_000, 530],
  [1_000_000, 580],
  [Infinity, 605],
];

const MAX_DOLLARS = 1_000_000_000;
const GIT_REP_RATE = 1075;
const HOME_SALE_GUIDE_RATE = 897;

function toCents(value, label, min = 0) {
  if (!Number.isFinite(value) || value < min || Math.abs(value) > MAX_DOLLARS || Math.round(value * 100) / 100 !== value) {
    throw new RangeError(`${label} must be a valid amount in dollars and cents.`);
  }
  return Math.round(value * 100);
}

function percentageOf(cents, basisPoints) {
  return Math.round(cents * basisPoints / 10_000);
}

export function mansionTax(salePrice) {
  const price = toCents(salePrice, 'Sale price', 0.01);
  const [, rate] = MANSION_TIERS.find(([ceiling]) => price <= ceiling * 100);
  return { rate: rate / 100, fee: percentageOf(price, rate) / 100 };
}

export function priceCliff(salePrice) {
  toCents(salePrice, 'Sale price', 0.01);
  const [threshold] = MANSION_TIERS.reduce((closest, tier) =>
    Math.abs(salePrice - tier[0]) < Math.abs(salePrice - closest[0]) ? tier : closest
  );
  const feeAtThreshold = mansionTax(threshold).fee;
  const feeAbove = mansionTax(threshold + 1).fee;
  return {
    threshold,
    feeAtThreshold,
    feeAbove,
    feeIncrease: (Math.round(feeAbove * 100) - Math.round(feeAtThreshold * 100)) / 100,
  };
}

export function realtyTransferFee(salePrice) {
  const price = toCents(salePrice, 'Sale price', 0.01);
  if (price < 10_000) return 0;

  const schedule = price <= 35_000_000 ? STANDARD_RTF : HIGH_VALUE_RTF;
  let lower = 0;
  let fee = 0;
  for (const [upper, ratePerUnit] of schedule) {
    const end = Math.min(price, upper * 100);
    fee += Math.ceil((end - lower) / 50_000) * ratePerUnit;
    if (end === price) break;
    lower = end;
  }
  return fee / 100;
}

export function calculateClosingTaxes({
  salePrice, gain, resident = false, section121 = 'none', taxableGain = null, estimatedTax = null,
}) {
  const price = toCents(salePrice, 'Sale price', 0.01);
  const gainCents = toCents(gain, 'Estimated gain or loss', -MAX_DOLLARS);
  const reportableGain = taxableGain === null
    ? Math.max(0, gainCents)
    : toCents(taxableGain, 'Federal reportable gain');
  const finalTax = estimatedTax === null ? null : toCents(estimatedTax, 'Estimated NJ tax');
  const exclusionLimit = { none: 0, single: 25_000_000, joint: 50_000_000 }[section121];
  if (!Number.isInteger(exclusionLimit) || typeof resident !== 'boolean') {
    throw new RangeError('Choose a valid residency and Section 121 status.');
  }

  let exemption = null;
  if (resident) {
    exemption = 'resident';
  } else if (price <= 100_000) {
    exemption = 'low-consideration';
  } else if (section121 !== 'none' && gainCents <= exclusionLimit && (taxableGain === null || reportableGain === 0)) {
    exemption = 'section-121';
  }

  const floor = percentageOf(price, 200);
  const withholding = exemption ? 0 : Math.max(floor, percentageOf(reportableGain, GIT_REP_RATE));
  const guideComparison = exemption ? 0 : Math.max(floor, percentageOf(reportableGain, HOME_SALE_GUIDE_RATE));
  const refund = withholding === 0 ? 0 : finalTax === null ? null : Math.max(0, withholding - finalTax) / 100;
  const mansion = mansionTax(salePrice);
  const transferFee = realtyTransferFee(salePrice);

  return {
    mansion,
    transferFee,
    exemption,
    needsReview: !exemption && section121 !== 'none',
    form: exemption ? 'GIT/REP-3 EXEMPT' : 'GIT/REP-1 WITHHOLDING',
    withholding: withholding / 100,
    guideComparison: guideComparison / 100,
    refund,
    total: (Math.round(mansion.fee * 100) + Math.round(transferFee * 100) + withholding) / 100,
  };
}
