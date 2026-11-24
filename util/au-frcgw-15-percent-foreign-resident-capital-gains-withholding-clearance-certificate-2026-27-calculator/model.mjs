export const DEFAULT_WITHHOLDING_PERCENT = 15;
export const CERTIFICATE_LEAD_DAYS = 28;

const MAX_AMOUNT = 1_000_000_000;
const scenarios = {
  au_resident_with_cert: { foreign: false, certificate: true },
  au_resident_no_cert_trap: { foreign: false },
  foreign_resident_default_15: { foreign: true },
  foreign_resident_variation: { foreign: true, variation: true }
};
const residentGainShares = { exempt: 0, discount: 0.5, full: 1 };
const foreignBrackets = [[0, 135_000, 30], [135_000, 190_000, 37], [190_000, Infinity, 45]];
const residentBrackets = [
  [18_200, 45_000, 15], [45_000, 135_000, 30],
  [135_000, 190_000, 37], [190_000, Infinity, 45]
];

function range(value, name, min = 0, max = MAX_AMOUNT) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

function roundedCents(amount) {
  const magnitude = Math.abs(amount);
  const rounded = Math.round(magnitude + magnitude * Number.EPSILON);
  return rounded === 0 ? 0 : Math.sign(amount) * rounded;
}

function taxInRange(fromCents, toCents, foreign) {
  const brackets = foreign ? foreignBrackets : residentBrackets;
  const tax = brackets.reduce((sum, [lower, upper, rate]) => {
    const taxable = Math.max(0, Math.min(toCents, upper * 100) - Math.max(fromCents, lower * 100));
    return sum + taxable * rate / 100;
  }, 0);
  return roundedCents(tax);
}

export function individualIncomeTax(income, foreign) {
  return taxInRange(0, roundedCents(range(income, 'Taxable income') * 100), foreign) / 100;
}

// Property amounts are whole-property figures. Income and results belong to one vendor.
export function calculateSettlement({
  salePrice, status, ownershipPercent, mortgage, sellingCosts, costBase,
  variationPercent, otherIncome, residentCgt, daysToSettlement
}) {
  if (!Object.hasOwn(scenarios, status)) throw new RangeError('Choose a vendor scenario.');
  const { foreign, certificate, variation } = scenarios[status];
  const share = range(ownershipPercent, 'Ownership share', 0.01, 100) / 100;
  const price = roundedCents(range(salePrice, 'Sale price', 0.01) * 100);
  const shareOfPrice = roundedCents(price * share);
  const shareOfMortgage = roundedCents(roundedCents(range(mortgage, 'Mortgage payout') * 100) * share);
  const shareOfCosts = roundedCents(roundedCents(range(sellingCosts, 'Selling costs') * 100) * share);
  const shareOfCostBase = roundedCents(roundedCents(range(costBase, 'Cost base') * 100) * share);
  const income = roundedCents(range(otherIncome, 'Other taxable income') * 100);

  let withholdingPercent = DEFAULT_WITHHOLDING_PERCENT;
  if (certificate) withholdingPercent = 0;
  if (variation) withholdingPercent = range(variationPercent, 'Approved variation rate', 0, DEFAULT_WITHHOLDING_PERCENT);

  let certificateTiming = null;
  if (certificate) certificateTiming = 'valid';
  if (!foreign && !certificate) {
    range(daysToSettlement, 'Days until settlement', 0, 3650);
    if (!Number.isInteger(daysToSettlement)) throw new RangeError('Enter whole days until settlement.');
    certificateTiming = daysToSettlement < CERTIFICATE_LEAD_DAYS ? 'urgent' : 'apply';
  }
  if (!foreign && !Object.hasOwn(residentGainShares, residentCgt)) {
    throw new RangeError('Choose a resident CGT treatment.');
  }

  const vendorPrice = price * share;
  const withholding = roundedCents(vendorPrice * withholdingPercent / 100);
  const defaultWithholding = roundedCents(vendorPrice * DEFAULT_WITHHOLDING_PERCENT / 100);
  const balanceWithoutWithholding = shareOfPrice - shareOfCosts - shareOfMortgage;
  const settlementBalance = balanceWithoutWithholding - withholding;
  const gainBeforeRelief = Math.max(0, shareOfPrice - shareOfCosts - shareOfCostBase);
  const taxableGain = roundedCents(gainBeforeRelief * (foreign ? 1 : residentGainShares[residentCgt]));
  const estimatedCgt = taxInRange(income, income + taxableGain, foreign);

  return {
    foreign,
    withholdingPercent,
    certificateTiming,
    shareOfPrice: shareOfPrice / 100,
    shareOfMortgage: shareOfMortgage / 100,
    shareOfCosts: shareOfCosts / 100,
    withholding: withholding / 100,
    defaultWithholding: defaultWithholding / 100,
    netCash: Math.max(0, settlementBalance) / 100,
    shortfall: Math.max(0, -settlementBalance) / 100,
    settlementBalance: settlementBalance / 100,
    settlementBalanceWithoutWithholding: balanceWithoutWithholding / 100,
    gainBeforeRelief: gainBeforeRelief / 100,
    taxableGain: taxableGain / 100,
    estimatedCgt: estimatedCgt / 100,
    returnBalance: (withholding - estimatedCgt) / 100,
    defaultReturnBalance: (defaultWithholding - estimatedCgt) / 100,
    variationSavings: variation ? (defaultWithholding - withholding) / 100 : 0
  };
}
