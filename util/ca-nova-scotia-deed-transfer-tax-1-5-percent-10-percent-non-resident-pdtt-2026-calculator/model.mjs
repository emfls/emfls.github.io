export const municipalRates = Object.freeze({
  halifax: 1.5,
  capeBreton: 1.5,
  truro: 1.5,
  newGlasgow: 1,
  wolfville: 1.5,
  eastHants: 1.5,
  lunenburgDistrict: 1.25,
  lunenburgTown: 1.5,
  kingsCounty: 1.5,
  berwick: 1.25,
});

export const MAX_PRICE = 100_000_000;
const propertyTypes = ['one', 'two', 'three', 'vacant', 'fourPlus', 'nonResidential'];
const residencyOptions = ['pay', 'claim'];

function scaled(value, min, max, label) {
  const units = Math.round(value * 100);
  if (!Number.isFinite(value) || value < min || value > max || units / 100 !== value) {
    throw new RangeError(label + ' must be between ' + min + ' and ' + max + ' with up to two decimal places.');
  }
  return units;
}

// Round each tax to the nearest cent using integer arithmetic.
function taxCents(base, rateBps, shareBps = 10_000) {
  const numerator = BigInt(base) * BigInt(rateBps) * BigInt(shareBps);
  return Number((numerator + 50_000_000n) / 100_000_000n);
}

export function calculateTransferTaxes({
  purchasePrice, assessedValue, municipality, customRate, propertyType,
  nonResidentShare, residencyOption = 'pay', qualifyingShare = 0,
}) {
  const price = scaled(purchasePrice, 0.01, MAX_PRICE, 'Purchase price');
  const assessment = scaled(assessedValue, 0, MAX_PRICE, 'Assessed value');
  const share = scaled(nonResidentShare, 0, 100, 'Non-resident ownership');
  const qualifies = scaled(qualifyingShare, 0, nonResidentShare, 'Ownership qualifying through relocation');
  if (!propertyTypes.includes(propertyType) || !residencyOptions.includes(residencyOption)) {
    throw new RangeError('Select a property type and residency treatment.');
  }
  const municipalRate = municipality === 'custom' ? customRate : municipalRates[municipality];
  const rate = scaled(municipalRate, 0, 1.5, 'Municipal rate');
  const isEligibleProperty = propertyTypes.slice(0, 4).includes(propertyType);
  const pdttBase = Math.max(price, assessment);
  const paidShare = isEligibleProperty ? share - (residencyOption === 'claim' ? qualifies : 0) : 0;

  const municipalDtt = taxCents(price, rate);
  const grossPdtt = taxCents(pdttBase, 1000, isEligibleProperty ? share : 0);
  const pdtt = taxCents(pdttBase, 1000, paidShare);
  const oldRatePdtt = taxCents(pdttBase, 500, paidShare);
  const refundableAmount = residencyOption === 'pay' && isEligibleProperty
    ? pdtt - taxCents(pdttBase, 1000, share - qualifies)
    : 0;
  const totalUpfront = municipalDtt + pdtt;

  const ontarioHighRateApplies = propertyType === 'one' || propertyType === 'two';
  const ontarioLtt = Math.round((
    Math.min(price, 5_500_000) * 50
    + Math.max(0, Math.min(price, 25_000_000) - 5_500_000) * 100
    + Math.max(0, Math.min(price, 40_000_000) - 25_000_000) * 150
    + Math.max(0, price - 40_000_000) * 200
    + (ontarioHighRateApplies ? Math.max(0, price - 200_000_000) * 50 : 0)
  ) / 10_000);

  return {
    municipalRate,
    pdttBase: pdttBase / 100,
    municipalDtt: municipalDtt / 100,
    grossPdtt: grossPdtt / 100,
    pdtt: pdtt / 100,
    totalUpfront: totalUpfront / 100,
    totalPctOfPrice: totalUpfront / price * 100,
    increaseVsOldRate: (pdtt - oldRatePdtt) / 100,
    refundableAmount: refundableAmount / 100,
    ontarioLtt: ontarioLtt / 100,
    ontarioNrstIfApplicable: taxCents(price, 2500) / 100,
    ontarioTotalIfNrstApplies: (ontarioLtt + taxCents(price, 2500)) / 100,
    albertaRegistration: 50 + 5 * Math.ceil(price / 500_000),
  };
}
