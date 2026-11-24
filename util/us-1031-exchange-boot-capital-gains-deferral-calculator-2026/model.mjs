const MAX_DOLLARS = 1_000_000_000;
const DAY_MS = 86_400_000;
const MONEY_FIELDS = {
  originalPurchasePrice: 'Original purchase price',
  capitalImprovements: 'Capital improvements',
  accumulatedDepreciation: 'Accumulated depreciation',
  relinquishedSalePrice: 'Relinquished sale price',
  sellingExpenses: 'Selling expenses',
  relinquishedMortgage: 'Relinquished mortgage',
  replacementPrice: 'Replacement price',
  replacementClosingCosts: 'Eligible replacement closing costs',
  replacementMortgage: 'Replacement mortgage',
  cashReceivedOut: 'Cash kept from the exchange',
  additionalCashAdded: 'Additional cash paid into the exchange'
};

export const moneyFields = Object.freeze(Object.keys(MONEY_FIELDS));

function toHundredths(value, maximum, label) {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`${label} must be between 0 and ${maximum.toLocaleString('en-US')}.`);
  }
  const hundredths = Math.round(value * 100);
  if (hundredths / 100 !== value) {
    throw new RangeError(`${label} can have up to two decimal places.`);
  }
  return hundredths;
}

function taxOnGain(gain, depreciation, regularRateBasisPoints) {
  const unrecaptured = Math.min(gain, depreciation);
  const regular = gain - unrecaptured;
  // Round once per scenario. The integer rate denominator is 10,000.
  return Math.round((
    unrecaptured * 2500 + regular * regularRateBasisPoints
  ) / 10_000);
}

/** Planning estimate for one qualifying exchange of long-held §1250 real property. */
export function calculateExchange(input) {
  const amounts = Object.fromEntries(moneyFields.map(key => [
    key, toHundredths(input[key], MAX_DOLLARS, MONEY_FIELDS[key])
  ]));
  const {
    originalPurchasePrice, capitalImprovements, accumulatedDepreciation,
    relinquishedSalePrice, sellingExpenses, relinquishedMortgage,
    replacementPrice, replacementClosingCosts, replacementMortgage,
    cashReceivedOut: cashBoot, additionalCashAdded
  } = amounts;
  const stateRate = toHundredths(input.stateRate, 100, 'State tax rate');
  if (![15, 20].includes(input.ltcgRate)) throw new RangeError('Select a 15% or 20% LTCG rate.');
  if (typeof input.niit !== 'boolean') throw new RangeError('Select whether to include NIIT.');

  const adjustedBasis = originalPurchasePrice + capitalImprovements - accumulatedDepreciation;
  const netSalesPrice = relinquishedSalePrice - sellingExpenses;
  if (adjustedBasis < 0) throw new RangeError('Depreciation exceeds purchase price plus improvements.');
  if (netSalesPrice < 0) throw new RangeError('Selling expenses exceed the sale price.');

  const realizedGain = Math.max(0, netSalesPrice - adjustedBasis);
  const realizedLoss = Math.max(0, adjustedBasis - netSalesPrice);
  const relinquishedNetEquity = netSalesPrice - relinquishedMortgage;
  const rawDebtRelief = Math.max(0, relinquishedMortgage - replacementMortgage);
  const netMortgageBoot = Math.max(0, rawDebtRelief - additionalCashAdded);
  const totalBoot = cashBoot + netMortgageBoot;
  const recognizedGain = Math.min(realizedGain, totalBoot);
  const deferredGain = realizedGain - recognizedGain;
  const recognizedRecapture = Math.min(recognizedGain, accumulatedDepreciation);
  const recognizedLTCG = recognizedGain - recognizedRecapture;

  const regularRate = input.ltcgRate * 100 + (input.niit ? 380 : 0) + stateRate;
  const exchangeTax = taxOnGain(recognizedGain, accumulatedDepreciation, regularRate);
  const taxableSaleTax = taxOnGain(realizedGain, accumulatedDepreciation, regularRate);
  const taxDeferredToday = taxableSaleTax - exchangeTax;

  const carryoverBasis = replacementPrice + replacementClosingCosts - deferredGain;
  const netDebtAdded = Math.max(0, replacementMortgage - relinquishedMortgage);
  const basisCrossCheck = adjustedBasis + additionalCashAdded + netDebtAdded
    + recognizedGain - cashBoot - rawDebtRelief;
  const basisCrossCheckWithClosingCosts = basisCrossCheck + replacementClosingCosts;
  const basisDifference = carryoverBasis - basisCrossCheckWithClosingCosts;
  const fundingGap = replacementPrice - replacementMortgage
    - (relinquishedNetEquity - cashBoot + additionalCashAdded);

  return Object.fromEntries(Object.entries({
    adjustedBasis, netSalesPrice, realizedGain, realizedLoss, relinquishedNetEquity,
    cashBoot, rawDebtRelief, netMortgageBoot, totalBoot, recognizedGain, deferredGain,
    recognizedRecapture, recognizedLTCG, exchangeTax, taxableSaleTax, taxDeferredToday,
    carryoverBasis, basisCrossCheck, basisCrossCheckWithClosingCosts, basisDifference, fundingGap
  }).map(([key, cents]) => [key, cents / 100]));
}

function dateToTimestamp(isoDate, label) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || isoDate.startsWith('0000')) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  const timestamp = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== isoDate) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return timestamp;
}

/** Compute calendar dates in UTC to avoid daylight-saving and local-time shifts. */
export function calculateDeadlines(closingDate, returnDueDate = '') {
  const closing = dateToTimestamp(closingDate, 'transfer date');
  const day180 = closing + 180 * DAY_MS;
  const returnDue = returnDueDate === '' ? day180 : dateToTimestamp(returnDueDate, 'return due date');
  if (returnDue < closing) throw new RangeError('The return due date cannot precede the transfer date.');
  if (new Date(day180).getUTCFullYear() > 9999) throw new RangeError('Choose an earlier transfer date.');

  const iso = timestamp => new Date(timestamp).toISOString().slice(0, 10);
  return {
    identificationDeadline: iso(closing + 45 * DAY_MS),
    day180Deadline: iso(day180),
    exchangeDeadline: iso(Math.min(day180, returnDue))
  };
}
