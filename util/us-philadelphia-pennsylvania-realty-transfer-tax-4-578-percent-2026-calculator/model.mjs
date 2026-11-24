// Rates are stored in thousandths of a percentage point.
export const stateRate = 1000;
export const rates = Object.freeze({
  philadelphia: Object.freeze({ local: 3578 }),
  pittsburgh: Object.freeze({ local: 4000 }),
  reading: Object.freeze({ local: 4000 }),
  scranton: Object.freeze({ local: 2700 }),
  'wilkes-barre': Object.freeze({ local: 2500 }),
  suburbs: Object.freeze({ local: 1000 }),
});

const family = new Set(['spouse', 'parent-child', 'grandparent-grandchild', 'sibling']);

export function isFamilyRelationship(relationship) {
  return family.has(relationship);
}

function scaledInteger(value, decimals, min, max, message) {
  if (!Number.isFinite(value) || value < min || value > max || Number(value.toFixed(decimals)) !== value) {
    throw new RangeError(message);
  }
  return BigInt(Math.round(value * 10 ** decimals));
}

function toCents(value, min, message) {
  return scaledInteger(value, 2, min, 1_000_000_000, message);
}

function roundedProduct(amount, factor, divisor) {
  return (amount * factor + divisor / 2n) / divisor;
}

function taxAtRate(base, rate) {
  return roundedProduct(base, BigInt(rate), 100_000n);
}

export function calculateTransferTax({
  municipality,
  consideration,
  buyerShare,
  valuation = 'sale',
  assessment,
  clrFactor,
  relationship = 'none',
  confirmedExemption = false,
}) {
  if (!Object.hasOwn(rates, municipality)) throw new RangeError('Choose a municipality.');
  if (!['sale', 'computed', 'floor'].includes(valuation)) throw new RangeError('Choose a valuation method.');
  if (!['none', 'other'].includes(relationship) && !isFamilyRelationship(relationship)) {
    throw new RangeError('Choose a family relationship.');
  }

  const share = scaledInteger(buyerShare, 0, 0, 100, 'Enter a buyer share from 0% to 100%.');
  const exempt = confirmedExemption === true && isFamilyRelationship(relationship);
  let taxableBase = 0n;
  let computedValue = null;

  if (!exempt) {
    if (valuation !== 'computed') {
      taxableBase = toCents(consideration, valuation === 'sale' ? 0.01 : 0,
        'Enter valid consideration up to $1 billion, with at most two decimal places.');
    }
    if (valuation !== 'sale') {
      const assessedCents = toCents(assessment, 0.01,
        'Enter a positive county assessment up to $1 billion, with at most two decimal places.');
      const factor = scaledInteger(clrFactor, 4, 0.0001, 100,
        'Enter a CLR factor greater than zero and up to 100, with at most four decimal places.');
      computedValue = roundedProduct(assessedCents, factor, 10_000n);
      if (valuation === 'computed' || computedValue > taxableBase) taxableBase = computedValue;
    }
  }

  const appliedLocalRate = exempt ? 0 : rates[municipality].local;
  const appliedStateRate = exempt ? 0 : stateRate;
  const combined = appliedLocalRate + appliedStateRate;
  const localTax = taxAtRate(taxableBase, appliedLocalRate);
  const stateTax = taxAtRate(taxableBase, appliedStateRate);
  const totalTax = localTax + stateTax;
  const buyerTax = roundedProduct(totalTax, share, 100n);
  const philadelphiaTax = taxAtRate(taxableBase, rates.philadelphia.local) + stateTax;
  const suburbanTax = taxAtRate(taxableBase, rates.suburbs.local) + stateTax;
  const halfTax = roundedProduct(totalTax, 50n, 100n);

  return {
    exempt,
    taxableBase: Number(taxableBase) / 100,
    computedValue: computedValue === null ? null : Number(computedValue) / 100,
    localRate: appliedLocalRate / 1000,
    stateRate: appliedStateRate / 1000,
    totalRate: combined / 1000,
    buyerRate: combined * buyerShare / 100_000,
    sellerRate: combined * (100 - buyerShare) / 100_000,
    localTax: Number(localTax) / 100,
    stateTax: Number(stateTax) / 100,
    totalTax: Number(totalTax) / 100,
    buyerTax: Number(buyerTax) / 100,
    sellerTax: Number(totalTax - buyerTax) / 100,
    philadelphiaPremium: Number(philadelphiaTax - suburbanTax) / 100,
    buyerPremium: Number(
      roundedProduct(philadelphiaTax, share, 100n) - roundedProduct(suburbanTax, share, 100n)
    ) / 100,
    fullBuyerIncrease: Number(totalTax - halfTax) / 100,
  };
}
