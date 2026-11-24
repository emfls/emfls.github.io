export const INCLUSION_RATE = 0.5;
export const LCGE_CAP = 1_275_000;

const schedule = (bands) => Object.freeze(bands.map((band) => Object.freeze(band)));

export const FEDERAL_BRACKETS = schedule([
  [58_523, 0.14], [117_045, 0.205], [181_440, 0.26], [258_482, 0.29], [Infinity, 0.33],
]);

export const PROVINCES = Object.freeze({
  ON: Object.freeze({ brackets: schedule([
    [53_891, 0.0505], [107_785, 0.0915], [150_000, 0.1116], [220_000, 0.1216], [Infinity, 0.1316],
  ]) }),
  BC: Object.freeze({ brackets: schedule([
    [50_363, 0.056], [100_728, 0.077], [115_648, 0.105], [140_430, 0.1229],
    [190_405, 0.147], [265_545, 0.168], [Infinity, 0.205],
  ]) }),
  AB: Object.freeze({ brackets: schedule([
    [61_200, 0.08], [154_259, 0.10], [185_111, 0.12], [246_813, 0.13],
    [370_220, 0.14], [Infinity, 0.15],
  ]) }),
  QC: Object.freeze({ brackets: schedule([
    [54_345, 0.14], [108_680, 0.19], [132_245, 0.24], [Infinity, 0.2575],
  ]), federalFactor: 0.835 }),
  MB: Object.freeze({ brackets: schedule([
    [47_564, 0.108], [101_200, 0.1275], [Infinity, 0.174],
  ]) }),
  SK: Object.freeze({ brackets: schedule([
    [54_532, 0.105], [155_805, 0.125], [Infinity, 0.145],
  ]) }),
  NS: Object.freeze({ brackets: schedule([
    [30_995, 0.0879], [61_991, 0.1495], [97_417, 0.1667], [157_124, 0.175], [Infinity, 0.21],
  ]) }),
});

export function incrementalTax(income, addedIncome, brackets) {
  let addedTax = 0;
  let lower = 0;
  for (const [upper, rate] of brackets) {
    // Measure the overlap of the added income with this bracket directly.
    const offset = Math.max(0, lower - income);
    const end = Math.min(addedIncome, upper - income);
    addedTax += Math.max(0, end - offset) * rate;
    if (end === addedIncome) break;
    lower = upper;
  }
  return addedTax;
}

function taxOnGain(income, taxableGain, region) {
  const federalTaxAdded = incrementalTax(income, taxableGain, FEDERAL_BRACKETS)
    * (region.federalFactor ?? 1);
  const provincialTaxAdded = incrementalTax(income, taxableGain, region.brackets);
  return { federalTaxAdded, provincialTaxAdded, totalTax: federalTaxAdded + provincialTaxAdded };
}

export function calculateCapitalGains({
  saleProceeds,
  adjustedCostBase,
  sellingExpenses = 0,
  allowableCapitalLossesApplied = 0, // Gross-equivalent loss, before the 50% inclusion rate.
  otherTaxableIncome,
  province,
  lcgeEligible = false,
  lcgeCap = LCGE_CAP,
  priorLcgeUsed = 0, // Gross-equivalent exemption used.
  harvestLosses = 0,
  spouseShare = 0,
  spouseIncome,
}) {
  if (!Object.hasOwn(PROVINCES, province)) throw new RangeError('Choose a supported province.');
  const amounts = {
    saleProceeds, adjustedCostBase, sellingExpenses, allowableCapitalLossesApplied,
    otherTaxableIncome, harvestLosses, spouseShare,
    ...(lcgeEligible ? { lcgeCap, priorLcgeUsed } : {}),
    ...(spouseShare > 0 ? { spouseIncome } : {}),
  };
  for (const [name, value] of Object.entries(amounts)) {
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`Invalid amount for ${name}.`);
    }
  }
  if (spouseShare > 100 || (lcgeEligible && lcgeCap > LCGE_CAP)) {
    throw new RangeError('The ownership share or LCGE cap exceeds its limit.');
  }

  const region = PROVINCES[province];
  const saleGain = saleProceeds - adjustedCostBase - sellingExpenses;
  const capitalGain = Math.max(0, saleGain - allowableCapitalLossesApplied);
  const unusedLcge = lcgeEligible ? Math.max(0, lcgeCap - priorLcgeUsed) : 0;
  const lcgeApplied = Math.min(capitalGain, unusedLcge);
  const taxablePortion = INCLUSION_RATE * capitalGain;
  const netTaxableCapitalGain = INCLUSION_RATE * (capitalGain - lcgeApplied);
  const tax = taxOnGain(otherTaxableIncome, netTaxableCapitalGain, region);

  const harvestedTaxableGain = INCLUSION_RATE * Math.max(0, capitalGain - harvestLosses - unusedLcge);
  const harvestTax = taxOnGain(otherTaxableIncome, harvestedTaxableGain, region).totalTax;

  let spouseSplitSavings = null;
  if (spouseShare > 0 && !lcgeEligible && allowableCapitalLossesApplied === 0) {
    const spouseGain = netTaxableCapitalGain * (spouseShare / 100);
    const ownerTax = taxOnGain(otherTaxableIncome, netTaxableCapitalGain - spouseGain, region).totalTax;
    const spouseTax = taxOnGain(spouseIncome, spouseGain, region).totalTax;
    spouseSplitSavings = tax.totalTax - (ownerTax + spouseTax);
  }

  return {
    saleGain, capitalGain, taxablePortion, lcgeApplied, netTaxableCapitalGain,
    ...tax,
    effectiveRate: capitalGain > 0 ? tax.totalTax / capitalGain : null,
    afterTaxProceeds: saleProceeds - sellingExpenses - tax.totalTax,
    harvestSavings: tax.totalTax - harvestTax,
    spouseSplitSavings,
  };
}
