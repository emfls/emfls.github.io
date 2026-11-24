export const ANNUAL_GRANT_FMV_LIMIT = 25000;
export const MAX_DISCOUNT_RATE = 15;
export const ORDINARY_RATES = Object.freeze([10, 12, 22, 24, 32, 35, 37]);
export const LONG_TERM_RATES = Object.freeze([0, 15, 20]);
export const NIIT_RATE = 0.038;
export const NIIT_THRESHOLDS = Object.freeze({
  single: 200000, hoh: 200000, mfj: 250000, mfs: 125000, qss: 250000,
});

const DAY = 86400000;

function parseDate(value, label) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = Date.parse(value);
    if (Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value) return time;
  }
  throw new RangeError(`Enter a valid ${label} date.`);
}

function anniversary(time, years) {
  const date = new Date(time);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  // February 29 falls on the last day of February in a non-leap anniversary year.
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.getTime();
}

function dateString(time) {
  return new Date(time).toISOString().split('T')[0];
}

function checkNumber(value, min, max, message) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(message);
}

export function calculateEspp(input) {
  const {
    grantDate, purchaseDate, transferDate, saleDate, grantFmv, purchaseFmv, salePrice,
    shares, discountRate, lookback, ordinaryRate, longTermRate, stateRate,
    filingStatus, includeNiit, baseMagi, baseNii,
  } = input;
  const grant = parseDate(grantDate, 'grant');
  const purchase = parseDate(purchaseDate, 'purchase');
  const transfer = transferDate ? parseDate(transferDate, 'transfer') : purchase;
  const sale = parseDate(saleDate, 'sale');
  if (grant > purchase || purchase > transfer || transfer > sale) {
    throw new RangeError('Enter dates in order: grant, purchase, transfer (if different), then sale.');
  }
  checkNumber(grantFmv, 0.0001, 1e9, 'Grant-date FMV must be between $0.0001 and $1 billion.');
  checkNumber(purchaseFmv, 0.0001, 1e9, 'Purchase-date FMV must be between $0.0001 and $1 billion.');
  checkNumber(salePrice, 0, 1e9, 'Sale price must be between $0 and $1 billion.');
  if (!Number.isSafeInteger(shares) || shares < 1 || shares > 1e6) {
    throw new RangeError('Enter between 1 and 1,000,000 whole shares.');
  }
  checkNumber(discountRate, 0, MAX_DISCOUNT_RATE, 'Enter a discount between 0% and 15%.');
  checkNumber(stateRate, 0, 100, 'Enter a state rate between 0% and 100%.');
  if (!ORDINARY_RATES.includes(ordinaryRate) || !LONG_TERM_RATES.includes(longTermRate)) {
    throw new RangeError('Select valid federal ordinary-income and long-term capital-gain rates.');
  }
  if (!Object.hasOwn(NIIT_THRESHOLDS, filingStatus)) throw new RangeError('Select a filing status.');
  if (typeof lookback !== 'boolean' || typeof includeNiit !== 'boolean') {
    throw new RangeError('Select a valid lookback and NIIT setting.');
  }
  if (includeNiit) {
    checkNumber(baseMagi, -1e15, 1e15, 'Enter a valid pre-sale MAGI.');
    checkNumber(baseNii, 0, 1e15, 'Enter valid nonnegative pre-sale net investment income.');
  }

  const daysFromGrant = (sale - grant) / DAY;
  const daysFromPurchase = (sale - purchase) / DAY;
  const daysFromTransfer = (sale - transfer) / DAY;
  const longTermStart = anniversary(transfer, 1) + DAY;
  const qualifyingStart = Math.max(anniversary(grant, 2) + DAY, longTermStart);
  const elapsedDayCheck = {
    qualifying: daysFromGrant > 730 && daysFromPurchase > 365,
    longTerm: daysFromPurchase > 365,
  };

  const priceFactor = 100 - discountRate;
  const pricingBase = lookback ? Math.min(grantFmv, purchaseFmv) : purchaseFmv;
  const purchasePrice = pricingBase * priceFactor / 100;
  const lookbackSavings = (purchaseFmv - pricingBase) * priceFactor / 100 * shares;
  const contribution = purchasePrice * shares;
  const proceeds = salePrice * shares;
  const totalActualGain = (salePrice - purchasePrice) * shares;
  const grantDiscountCap = grantFmv * discountRate / 100 * shares;
  const annualShareLimit = Math.floor(ANNUAL_GRANT_FMV_LIMIT / grantFmv);
  const niitThreshold = NIIT_THRESHOLDS[filingStatus];
  const capitalLossLimit = filingStatus === 'mfs' ? 1500 : 3000;

  function investmentTax(magi, nii) {
    return NIIT_RATE * Math.max(0, Math.min(nii, magi - niitThreshold));
  }

  function disposition(dispositionDate) {
    const qualifying = dispositionDate >= qualifyingStart;
    const longTerm = dispositionDate >= longTermStart;
    const ordinaryIncome = qualifying
      ? Math.min(Math.max(0, totalActualGain), grantDiscountCap)
      : Math.max(0, purchaseFmv - purchasePrice) * shares;
    const adjustedCostBasis = qualifying ? contribution + ordinaryIncome : purchaseFmv * shares;
    const capitalGainOrLoss = qualifying ? totalActualGain - ordinaryIncome : (salePrice - purchaseFmv) * shares;
    const positiveCapitalGain = Math.max(0, capitalGainOrLoss);
    const federalOrdinaryTax = ordinaryIncome * ordinaryRate / 100;
    const federalCapitalTax = positiveCapitalGain * (longTerm ? longTermRate : ordinaryRate) / 100;
    const stateTax = (ordinaryIncome + positiveCapitalGain) * stateRate / 100;
    // Compensation counts toward MAGI. This estimate excludes tax effects of capital losses.
    const niit = includeNiit
      ? investmentTax(baseMagi + ordinaryIncome + positiveCapitalGain, baseNii + positiveCapitalGain) -
        investmentTax(baseMagi, baseNii)
      : 0;
    const fica = 0;
    const totalTax = federalOrdinaryTax + federalCapitalTax + stateTax + niit + fica;
    const netProfit = totalActualGain - totalTax;
    return {
      saleDate: dateString(dispositionDate), qualifying, longTerm, ordinaryIncome, adjustedCostBasis,
      basisIncrease: ordinaryIncome, form8949Adjustment: ordinaryIncome ? -ordinaryIncome : 0,
      capitalGainOrLoss, federalOrdinaryTax, federalCapitalTax, stateTax, niit, fica, totalTax,
      netProfit, returnOnContribution: netProfit / contribution * 100,
    };
  }

  const actual = disposition(sale);
  const hold = disposition(Math.max(sale, qualifyingStart));
  return {
    daysFromGrant, daysFromPurchase, daysFromTransfer, elapsedDayCheck,
    qualifyingDate: dateString(qualifyingStart), longTermStart: dateString(longTermStart),
    purchasePrice, pricingBase, lookbackSavings, grantDiscountCap, contribution, proceeds, totalActualGain,
    annualShareLimit, exceedsAnnualLimit: shares > annualShareLimit, niitThreshold, capitalLossLimit,
    actual, hold, taxSavings: actual.totalTax - hold.totalTax,
  };
}
