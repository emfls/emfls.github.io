export const DIVIDEND_RATES = Object.freeze(Object.fromEntries([
  ['ON', 'Ontario', 39.34, 47.74],
  ['BC', 'British Columbia', 36.54, 48.89],
  ['AB', 'Alberta', 34.31, 42.31],
  ['QC', 'Quebec', 40.11, 48.70],
  ['SK', 'Saskatchewan', 29.64, 41.34],
  ['MB', 'Manitoba', 37.78, 46.67],
  ['NS', 'Nova Scotia', 41.58, 49.99]
].map(([code, name, eligible, nonEligible]) => [
  code, Object.freeze({ name, eligible, nonEligible })
])));

function decimalUnits(value, label, maximum) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text) || Number(text) > maximum) {
    throw new RangeError(`${label} must be between 0 and ${maximum.toLocaleString('en-CA')} with up to two decimal places.`);
  }
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function rateUnits(override, rate, label) {
  return override === undefined || (typeof override === 'string' && override.trim() === '')
    ? Math.round(rate * 100)
    : decimalUnits(override, label, 100);
}

export function calculateCda(inputs) {
  const money = (value, label) => decimalUnits(value, label, 1_000_000_000);
  const gains = money(inputs.capitalGains, 'Realized capital gains');
  const losses = money(inputs.realizedLosses, 'Realized capital losses');
  const futureLosses = money(inputs.futureLosses, 'Potential future capital losses');
  const deathBenefit = money(inputs.deathBenefit, 'Death benefit received');
  const policyAcb = money(inputs.policyAcb, 'Policy adjusted cost basis');
  const received = money(inputs.dividendsReceived, 'Capital dividends received');
  const prior = money(inputs.priorDividends, 'Prior capital dividends payable');
  const planned = money(inputs.plannedElection, 'Planned election');

  const { province, comparison } = inputs;
  if (!Object.hasOwn(DIVIDEND_RATES, province)) throw new RangeError('Select a listed province.');
  if (comparison !== 'planned' && comparison !== 'available') throw new RangeError('Select a comparison amount.');

  // Use integer half-cents internally so an odd number of cents at 50% stays exact.
  const gainsComponent = Math.max(0, gains - losses);
  const projectedGainsComponent = Math.max(0, gains - losses - futureLosses);
  const insuranceComponent = Math.max(0, deathBenefit - policyAcb) * 2;
  const otherComponents = insuranceComponent + (received - prior) * 2;
  const net = gainsComponent + otherComponents;
  const available = Math.max(0, net);
  const projected = Math.max(0, projectedGainsComponent + otherComponents);
  const safeCents = Math.floor(available / 2);
  const excess = Math.max(0, planned * 2 - available);
  const comparisonCents = comparison === 'available' ? safeCents : Math.min(planned, safeCents);
  const nonEligibleRate = rateUnits(inputs.nonEligibleRateOverride, DIVIDEND_RATES[province].nonEligible, 'Non-eligible rate');
  const eligibleRate = rateUnits(inputs.eligibleRateOverride, DIVIDEND_RATES[province].eligible, 'Eligible rate');

  return {
    gainsComponent: gainsComponent / 200,
    insuranceComponent: insuranceComponent / 200,
    netCdaBalance: net / 200,
    availableCdaBalance: available / 200,
    safeMaximum: safeCents / 100,
    status: excess > 0 ? 'EXCESS_PENALTY' : 'SAFE',
    excess: excess / 200,
    partIIITax: excess * 3 / 1000,
    projectedCdaBalance: projected / 200,
    timingRoomLost: (available - projected) / 200,
    projectedElectionExcess: Math.max(0, planned * 2 - projected) / 200,
    comparisonCash: comparisonCents / 100,
    eligibleRate: eligibleRate / 100,
    nonEligibleRate: nonEligibleRate / 100,
    personalTaxSavedEligible: Math.round(comparisonCents * eligibleRate / 10_000) / 100,
    personalTaxSavedNonEligible: Math.round(comparisonCents * nonEligibleRate / 10_000) / 100
  };
}
