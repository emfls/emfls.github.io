const MAX_DOLLARS = 1_000_000_000_000;

function toCents(amount, label) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_DOLLARS) {
    throw new RangeError(label + ' must be between $0 and $1 trillion.');
  }
  const cents = Math.round(amount * 100);
  if (cents / 100 !== amount) {
    throw new RangeError(label + ' must have no more than two decimal places.');
  }
  return cents;
}

export function calculateFirpta({
  salePrice,
  qualifyingResidence,
  purchasePrice,
  capitalImprovements,
  accumulatedDepreciation,
  sellingCosts,
  ltcgRate,
}) {
  const gross = toCents(salePrice, 'Gross amount realized');
  const basisBeforeDepreciation = toCents(purchasePrice, 'Purchase price')
    + toCents(capitalImprovements, 'Capital improvements');
  const depreciation = toCents(accumulatedDepreciation, 'Accumulated depreciation');
  const costs = toCents(sellingCosts, 'Selling costs');
  if (gross === 0) throw new RangeError('Gross amount realized must be greater than zero.');
  if (depreciation > basisBeforeDepreciation) {
    throw new RangeError('Accumulated depreciation cannot exceed purchase price plus capital improvements.');
  }
  if (typeof qualifyingResidence !== 'boolean') throw new RangeError('Choose the buyer’s intended use.');
  if (ltcgRate !== 0.15 && ltcgRate !== 0.20) throw new RangeError('Choose a 15% or 20% capital gains rate.');

  let withholdingPercent = 15;
  if (qualifyingResidence && gross <= 30_000_000) {
    withholdingPercent = 0;
  } else if (qualifyingResidence && gross <= 100_000_000) {
    withholdingPercent = 10;
  }

  // Keep inputs and intermediate amounts in cents. Round each payable amount once.
  const withheld = Math.round(gross * withholdingPercent / 100);
  const basis = basisBeforeDepreciation - depreciation;
  const gain = Math.max(0, gross - costs - basis);
  const section1250 = Math.min(gain, depreciation);
  const capitalGain = gain - section1250;
  const ltcgPercent = Math.round(ltcgRate * 100);
  const tax = Math.round((section1250 * 25 + capitalGain * ltcgPercent) / 100);

  return {
    firptaRate: withholdingPercent / 100,
    firptaWithholding: withheld / 100,
    adjustedBasis: basis / 100,
    totalGain: gain / 100,
    unrecaptured1250: section1250 / 100,
    remainingCapitalGain: capitalGain / 100,
    estimatedActualTax: tax / 100,
    potentialRelease: Math.max(0, withheld - tax) / 100,
  };
}
