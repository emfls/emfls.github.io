export const PROP19_EXCLUSION = 1_044_586;

const ulaThresholds = Object.freeze({
  'jan-jun': Object.freeze({ lower: 5_300_000, upper: 10_600_000 }),
  'jul-dec': Object.freeze({ lower: 5_400_000, upper: 10_900_000 })
});
const relationships = ['parent-child', 'grandparent-eligible', 'grandparent-ineligible'];

function moneyInCents(value, label, minimum = 0) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < minimum || value > 1_000_000_000 || cents / 100 !== value) {
    throw new RangeError(`${label} must be between $${minimum} and $1 billion, with up to two decimal places.`);
  }
  return cents;
}

export function calculateProp19({
  priorAssessedValue, fairMarketValue, taxRatePercent, exclusion = PROP19_EXCLUSION,
  relationship, familyHome, timelyOccupancy
}) {
  const prior = moneyInCents(priorAssessedValue, 'Prior assessed value');
  const market = moneyInCents(fairMarketValue, 'Fair market value', 0.01);
  const ceiling = prior + moneyInCents(exclusion, 'Indexed exclusion');
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
    throw new RangeError('Annual tax rate must be between 0% and 100%.');
  }
  if (!relationships.includes(relationship) || typeof familyHome !== 'boolean' || typeof timelyOccupancy !== 'boolean') {
    throw new RangeError('Select the relationship and both residence conditions.');
  }

  const canQualify = familyHome && relationship !== 'grandparent-ineligible';
  const eligible = canQualify && timelyOccupancy;
  const eligibleAssessment = prior + Math.max(0, market - ceiling);
  const assessment = eligible ? eligibleAssessment : market;
  const annualTax = value => Math.round(value * taxRatePercent / 100);
  const priorTax = annualTax(prior);
  const newTax = annualTax(assessment);
  const change = newTax - priorTax;
  const savings = annualTax(market) - annualTax(eligibleAssessment);

  return {
    eligible,
    exclusionCeiling: ceiling / 100,
    newAssessedValue: assessment / 100,
    priorAnnualTax: priorTax / 100,
    newAnnualTax: newTax / 100,
    annualTaxChange: change / 100,
    tenYearTaxChange: change * 10 / 100,
    annualMoveInSavings: canQualify ? savings / 100 : null,
    tenYearMoveInSavings: canQualify ? savings * 10 / 100 : null
  };
}

export function calculateMeasureULA({ salePrice, remainingLiens = 0, period = 'jul-dec' }) {
  const gross = moneyInCents(salePrice, 'Gross sale price', 0.01);
  const liens = moneyInCents(remainingLiens, 'Remaining liens');
  if (liens > gross) throw new RangeError('Remaining liens cannot exceed the gross sale price.');
  if (!Object.hasOwn(ulaThresholds, period)) throw new RangeError('Select a 2026 closing period.');

  const { lower, upper } = ulaThresholds[period];
  const rateBasisPoints = gross >= upper * 100 ? 550 : gross > lower * 100 ? 400 : 0;
  const net = gross - liens;
  const baseUnits = net > 10_000 ? Math.ceil(net / 50_000) : 0;
  const city = baseUnits * 225;
  const county = baseUnits * 55;
  const ula = Math.round(gross * rateBasisPoints / 10_000);
  const total = city + county + ula;

  return {
    lowerThreshold: lower,
    upperThreshold: upper,
    ulaRatePercent: rateBasisPoints / 100,
    baseCityTax: city / 100,
    baseCountyTax: county / 100,
    baseTransferTax: (city + county) / 100,
    ulaTax: ula / 100,
    totalTransferTax: total / 100,
    sellerNetProceeds: (net - total) / 100
  };
}
