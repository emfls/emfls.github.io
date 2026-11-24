const EXEMPT_THRESHOLD_CENTS = 10000000n;
const FLAT_THRESHOLD_CENTS = 50000000n;
const SQUARE_METRES_PER_HECTARE = 10000;
const RESIDENTIAL_LIMIT_SQUARE_METRES = 20000;
const DAYS_PER_MODEL_YEAR = 365;
const HORIZONS = [5, 10, 15, 30];

function validate(value, label, minimum = 0, maximum = 1e9) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(label + ' must be between ' + minimum + ' and ' + maximum + '.');
  }
}

const toCents = dollars => Math.round(dollars * 100);

export function assessWgt({ preRezoningCiv, postRezoningCiv, allowableDeductions, hectares, residential }) {
  validate(preRezoningCiv, 'Pre-rezoning CIV');
  validate(postRezoningCiv, 'Post-rezoning CIV');
  validate(allowableDeductions, 'Prescribed deductions');
  validate(hectares, 'Land area', 0.0001, 100000);
  if (typeof residential !== 'boolean') throw new TypeError('Choose whether the land qualifies.');

  const valueChange = toCents(postRezoningCiv) - toCents(preRezoningCiv);
  const uplift = Math.max(0, valueChange - toCents(allowableDeductions));
  const area = Math.round(hectares * SQUARE_METRES_PER_HECTARE);
  const taxableArea = residential ? Math.max(0, area - RESIDENTIAL_LIMIT_SQUARE_METRES) : area;
  const exemption = !residential ? 'none' : taxableArea === 0 ? 'full' : 'partial';
  // Keep apportionment fractional until the tier and tax are determined in cents.
  const areaDenominator = BigInt(area);
  const upliftNumerator = BigInt(uplift) * BigInt(taxableArea);
  const lowerBoundary = EXEMPT_THRESHOLD_CENTS * areaDenominator;
  const upperBoundary = FLAT_THRESHOLD_CENTS * areaDenominator;

  let tier = 'EXEMPT_UNDER_100K';
  let bandBaseNumerator = 0n;
  let bandRate = 0;
  let rateEighths = 0n;
  if (upliftNumerator >= upperBoundary) {
    tier = 'FLAT_50_PCT';
    bandBaseNumerator = upliftNumerator;
    bandRate = 50;
    rateEighths = 4n;
  } else if (upliftNumerator > lowerBoundary) {
    tier = 'MARGINAL_62_5_PCT';
    bandBaseNumerator = upliftNumerator - lowerBoundary;
    bandRate = 62.5;
    rateEighths = 5n;
  }

  const taxDenominator = areaDenominator * 8n;
  const tax = Number((bandBaseNumerator * rateEighths + taxDenominator / 2n) / taxDenominator);
  const taxableUplift = Number(upliftNumerator) / area;
  return {
    tier, bandRate, exemption, tax: tax / 100,
    bandTaxBase: Number(bandBaseNumerator) / area / 100,
    valueChange: valueChange / 100,
    uplift: uplift / 100,
    taxableUplift: taxableUplift / 100,
    exemptUplift: (uplift - taxableUplift) / 100,
    effectiveRate: uplift > 0 ? tax / uplift * 100 : 0,
    netEquity: (valueChange - tax) / 100,
  };
}

export function projectDeferral({ tax, deferredPercent, annualRatePercent }) {
  validate(tax, 'WGT assessment');
  validate(deferredPercent, 'Share deferred (%)', 0, 100);
  validate(annualRatePercent, 'Deferral interest rate (%)', 0, 100);
  const assessment = toCents(tax);
  const principal = Math.round(assessment * deferredPercent / 100);
  const dailyRate = annualRatePercent / (100 * DAYS_PER_MODEL_YEAR);

  const schedule = HORIZONS.map(years => {
    const days = years * DAYS_PER_MODEL_YEAR;
    const interest = Math.round(principal * dailyRate * days);
    return {
      years, days, interest: interest / 100,
      balance: (principal + interest) / 100,
      totalPaid: (assessment + interest) / 100,
    };
  });

  return { dueNow: (assessment - principal) / 100, deferredPrincipal: principal / 100, schedule };
}

export function compareSale({
  preRezoningCiv, saleProceeds, baseCost, effectiveCgtPercent, includeWgtInCostBase, tax, interest,
}) {
  validate(preRezoningCiv, 'Pre-rezoning CIV');
  validate(saleProceeds, 'Sale proceeds');
  validate(baseCost, 'Starting CGT cost base');
  validate(effectiveCgtPercent, 'Effective CGT rate (%)', 0, 100);
  validate(tax, 'WGT assessment');
  validate(interest, 'Deferral interest', 0, 30e9);
  if (typeof includeWgtInCostBase !== 'boolean') throw new TypeError('Choose a CGT cost base treatment.');

  const proceeds = toCents(saleProceeds);
  const preValue = toCents(preRezoningCiv);
  const startingBase = toCents(baseCost);
  const estimateTax = gain => Math.round(gain * effectiveCgtPercent / 100);
  const baselineCgt = estimateTax(Math.max(0, preValue - startingBase));

  function scenario(wgtCost) {
    const costBase = startingBase + (includeWgtInCostBase ? wgtCost : 0);
    const gain = Math.max(0, proceeds - costBase);
    const cgt = estimateTax(gain);
    return {
      costBase: costBase / 100,
      gain: gain / 100,
      cgt: cgt / 100,
      netUplift: (proceeds - preValue - wgtCost - (cgt - baselineCgt)) / 100,
    };
  }

  return { payNow: scenario(toCents(tax)), defer: scenario(toCents(tax) + toCents(interest)) };
}
