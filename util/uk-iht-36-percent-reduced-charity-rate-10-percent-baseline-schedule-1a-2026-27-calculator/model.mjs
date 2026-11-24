const MAX_AMOUNT = 100_000_000_000;
const MAX_NRB = 650_000;
const MAX_RESIDENCE_NRB = 350_000;
const TAPER_THRESHOLD_PENCE = 200_000_000;

function toPence(value, label, max = MAX_AMOUNT) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      value > max || value !== Math.round(value * 100) / 100) {
    throw new RangeError(`${label} must be between £0 and £${max.toLocaleString('en-GB')}, with up to two decimal places.`);
  }
  return Math.round(value * 100);
}

// One general component. Inputs and returned monetary amounts are in pounds.
export function calculateIht({
  netFreeEstate,
  unusedPension = 0,
  includePension = false,
  availableNrb,
  residenceNrb = 0,
  qualifyingHomeValue = null,
  plannedGift,
}) {
  if (typeof includePension !== 'boolean') {
    throw new RangeError('Select whether to include the April 2027 pension preview.');
  }
  const freeEstate = toPence(netFreeEstate, 'Net free estate');
  const pensionPot = toPence(unusedPension, 'Unused pension');
  const pension = includePension ? pensionPot : 0;
  const estate = freeEstate + pension;
  const nrb = toPence(availableNrb, 'Nil-rate band', MAX_NRB);
  const residenceBand = toPence(residenceNrb, 'Residence nil-rate band', MAX_RESIDENCE_NRB);
  const homeValue = qualifyingHomeValue === null
    ? Infinity : toPence(qualifyingHomeValue, 'Qualifying home share');
  const gift = toPence(plannedGift, 'Charity gift');
  if (gift > estate) {
    throw new RangeError('Charity gift cannot exceed the estate included in this scenario.');
  }

  const taper = Math.max(0, estate - TAPER_THRESHOLD_PENCE) / 2;
  const appliedResidenceBand = Math.min(homeValue, Math.max(0, residenceBand - taper));
  const baseline = Math.max(0, estate - nrb);
  const requiredGift = Math.ceil(baseline / 10);
  const qualifies = baseline > 0 && gift >= requiredGift;

  function scenario(donation, ratePercent) {
    const taxable = Math.max(0, estate - donation - nrb - appliedResidenceBand);
    const tax = Math.round(taxable * ratePercent / 100);
    return {
      gift: donation / 100,
      taxable: taxable / 100,
      rate: ratePercent / 100,
      tax: tax / 100,
      heirs: (estate - donation - tax) / 100,
    };
  }

  const noGift = scenario(0, 40);
  const planned = scenario(gift, qualifies ? 36 : 40);
  const threshold = scenario(requiredGift, baseline > 0 ? 36 : 40);
  const difference = (a, b) => Math.round((a - b) * 100) / 100;
  const cost = difference(noGift.heirs, threshold.heirs);
  const topUp = gift < requiredGift ? {
    giftIncrease: (requiredGift - gift) / 100,
    taxSaved: difference(planned.tax, threshold.tax),
    heirsChange: difference(threshold.heirs, planned.heirs),
  } : null;

  return {
    netEstate: estate / 100,
    pensionIncluded: pension / 100,
    appliedResidenceNrb: appliedResidenceBand / 100,
    baselineAmount: baseline / 100,
    exactThreshold: baseline / 1000,
    requiredGift: requiredGift / 100,
    qualifies,
    plannedGiftPercent: baseline > 0 ? gift / baseline * 100 : null,
    noGift,
    planned,
    threshold,
    plannedTaxSaved: difference(noGift.tax, planned.tax),
    thresholdTaxSaved: difference(noGift.tax, threshold.tax),
    thresholdCostToHeirs: cost,
    thresholdCostPercent: baseline > 0 ? cost / baseline * 10000 : null,
    topUp,
    bothGain: topUp !== null && topUp.heirsChange > 0,
  };
}
