const DAY_MS = 86_400_000;
export const WASH_WINDOW_DAYS = 30;

function calendarDay(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new RangeError(label + ' must be a valid calendar date.');
  }
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new RangeError(label + ' must be a valid calendar date.');
  }
  return ms / DAY_MS;
}

function formatDay(day) {
  const date = new Date(day * DAY_MS);
  const year = date.getUTCFullYear();
  if (!(year >= 1 && year <= 9999)) {
    throw new RangeError('The calculated date is outside the supported calendar range.');
  }
  return date.toISOString().slice(0, 10);
}

export function calculateWashSale({
  saleDate, replacementDate, sharesSold, origBuyPrice, salePrice, replacementShares,
  replacementPrice, accountType, origDaysHeld, otherCapGains, marginalTaxRate, marriedFilingSeparately,
}) {
  const numericFields = [
    ['Shares sold', sharesSold], ['Original basis', origBuyPrice], ['Sale price', salePrice],
    ['Replacement shares', replacementShares], ['Replacement price', replacementPrice],
    ['Original holding days', origDaysHeld], ['Other net capital gains', otherCapGains],
    ['Marginal tax rate', marginalTaxRate],
  ];
  for (const [label, value] of numericFields) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(label + ' must be a finite, nonnegative number.');
    }
  }
  if (sharesSold === 0) throw new RangeError('Shares sold must be greater than zero.');
  if (!Number.isSafeInteger(origDaysHeld)) throw new RangeError('Enter whole days for the original holding period.');
  if (marginalTaxRate > 100) throw new RangeError('Marginal tax rate must be between 0% and 100%.');
  if (typeof marriedFilingSeparately !== 'boolean') throw new RangeError('Choose a filing status.');

  const taxable = accountType === 'taxable_brokerage';
  if (!taxable && accountType !== 'ira_or_roth_ira') throw new RangeError('Choose a replacement account.');

  const saleDay = calendarDay(saleDate, 'Sale date');
  const replacementDay = replacementShares > 0 ? calendarDay(replacementDate, 'Replacement date') : null;
  const dayOffset = replacementDay === null ? null : replacementDay - saleDay;
  const inWindow = dayOffset !== null && Math.abs(dayOffset) <= WASH_WINDOW_DAYS;

  const realizedLossPerShare = Math.max(0, origBuyPrice - salePrice);
  const totalRealizedLoss = realizedLossPerShare * sharesSold;
  const washShares = inWindow && totalRealizedLoss > 0 ? Math.min(sharesSold, replacementShares) : 0;
  const disallowedLoss = washShares * realizedLossPerShare;
  const currentlyDeductibleLoss = totalRealizedLoss - disallowedLoss;
  const adjustedBasisPerWashShare = washShares > 0
    ? replacementPrice + (taxable ? realizedLossPerShare : 0)
    : null;
  if (!Number.isFinite(totalRealizedLoss) || !Number.isFinite(adjustedBasisPerWashShare ?? 0)) {
    throw new RangeError('The calculated amounts exceed the supported range.');
  }

  const hasTaxableMatch = taxable && washShares > 0;
  const tackedHoldingDays = hasTaxableMatch ? origDaysHeld : 0;
  const tackedHoldingDate = hasTaxableMatch ? formatDay(replacementDay - origDaysHeld) : null;
  const estimatedTaxBenefit = disallowedLoss * (marginalTaxRate / 100);

  const lossOffsettingCapGains = Math.min(currentlyDeductibleLoss, otherCapGains);
  const remainingNetLoss = currentlyDeductibleLoss - lossOffsettingCapGains;
  const ordinaryIncomeLimit = marriedFilingSeparately ? 1500 : 3000;
  const ordinaryIncomeDeduction = Math.min(remainingNetLoss, ordinaryIncomeLimit);

  return {
    windowStart: formatDay(saleDay - WASH_WINDOW_DAYS),
    windowEnd: formatDay(saleDay + WASH_WINDOW_DAYS),
    safeRepurchaseDate: formatDay(saleDay + WASH_WINDOW_DAYS + 1),
    dayOffset, realizedLossPerShare, totalRealizedLoss, washShares, disallowedLoss,
    currentlyDeductibleLoss, adjustedBasisPerWashShare, tackedHoldingDays, tackedHoldingDate,
    form8949Adjustment: disallowedLoss,
    deferredTaxBenefit: taxable ? estimatedTaxBenefit : 0,
    permanentTaxBenefitLost: taxable ? 0 : estimatedTaxBenefit,
    lossOffsettingCapGains, remainingNetLoss, ordinaryIncomeLimit, ordinaryIncomeDeduction,
    capitalLossCarryforward: remainingNetLoss - ordinaryIncomeDeduction,
  };
}
