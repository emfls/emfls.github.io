export const NIL_RATE_BAND = 325_000;
export const RESIDENCE_NIL_RATE_BAND = 175_000;
export const RESIDENCE_TAPER_THRESHOLD = 2_000_000;
export const STANDARD_RATE = 40;
export const MAX_AMOUNT = 1_000_000_000_000;

function checkRange(value, max, label) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(label + ' must be between 0 and ' + max + '.');
  }
  return value;
}

function toPence(value, label, max = MAX_AMOUNT) {
  const pence = Math.round(checkRange(value, max, label) * 100);
  if (pence / 100 !== value) {
    throw new RangeError(label + ' must be in pounds and whole pence.');
  }
  return pence;
}

export function getGiftRate(years) {
  checkRange(years, Number.MAX_VALUE, 'Years survived');
  if (years < 3) return 0.40;
  if (years < 4) return 0.32;
  if (years < 5) return 0.24;
  if (years < 6) return 0.16;
  if (years < 7) return 0.08;
  return 0;
}

export function calculateIht({
  priorGifts, giftValue, annualExemption, weddingExemption, yearsSurvived, estateValue,
  outOfIncome = false, transferredNrbPercent = 0, residenceValue = 0,
  taperEstateValue = estateValue,
}) {
  const prior = toPence(priorGifts, 'Earlier gifts');
  const gift = toPence(giftValue, 'Gift value');
  const annual = toPence(annualExemption, 'Annual exemption', 6_000);
  const estate = toPence(estateValue, 'Remaining estate');
  const home = toPence(residenceValue, 'Qualifying home share');
  const taperEstate = toPence(taperEstateValue, 'Estate value for residence taper');
  checkRange(transferredNrbPercent, 100, 'Transferred nil-rate band percentage');
  if (![0, 1000, 2500, 5000].includes(weddingExemption)) {
    throw new RangeError('Select a valid wedding or civil partnership exemption.');
  }
  if (typeof outOfIncome !== 'boolean') {
    throw new RangeError('The income exemption must be true or false.');
  }
  if (taperEstate < estate || home > taperEstate) {
    throw new RangeError('The estate value for residence taper must cover both the remaining estate and the qualifying home share.');
  }

  const taperRate = getGiftRate(yearsSurvived);
  const netGift = outOfIncome ? 0 : Math.max(0, gift - annual - weddingExemption * 100);
  const ownBand = NIL_RATE_BAND * 100;
  const transferredBand = Math.round(ownBand * transferredNrbPercent / 100);
  const totalBand = ownBand + transferredBand;

  // All earlier inputs are PETs within the death window. By the current gift’s
  // seventh anniversary, those earlier PETs have already left that window too.
  const priorChargeable = yearsSurvived < 7 ? prior : 0;
  const currentChargeable = yearsSurvived < 7 ? netGift : 0;
  const donorBandBeforeGift = Math.max(0, ownBand - priorChargeable);
  const bandBeforeGift = Math.max(0, totalBand - priorChargeable);
  const bandUsed = Math.min(currentChargeable, bandBeforeGift);
  const ownBandUsed = Math.min(currentChargeable, donorBandBeforeGift);
  const excess = currentChargeable - bandUsed;
  const giftTax = Math.round(excess * Math.round(taperRate * 100) / 100);
  const untaperedGiftTax = Math.round(excess * STANDARD_RATE / 100);
  const estateBand = bandBeforeGift - bandUsed;

  const adjustedResidenceBand = Math.max(0, RESIDENCE_NIL_RATE_BAND * 100
    - Math.max(0, taperEstate - RESIDENCE_TAPER_THRESHOLD * 100) / 2);
  const residenceBand = Math.min(home, adjustedResidenceBand);
  const estateTax = Math.round(Math.max(0, estate - estateBand - residenceBand) * STANDARD_RATE / 100);
  const yearSevenTax = Math.round(Math.max(0, estate - totalBand - residenceBand) * STANDARD_RATE / 100);
  const combinedTax = giftTax + estateTax;

  return {
    taperRate,
    netChargeableGift: netGift / 100,
    remainingNrbBeforeGift: bandBeforeGift / 100,
    nrbUsedByThisGift: bandUsed / 100,
    ownNrbUsedByThisGift: ownBandUsed / 100,
    transferredNrbUsedByThisGift: (bandUsed - ownBandUsed) / 100,
    excessOverNrb: excess / 100,
    giftIhtPayableByRecipient: giftTax / 100,
    taperSavings: (untaperedGiftTax - giftTax) / 100,
    estateNrbLeft: estateBand / 100,
    residenceNrb: residenceBand / 100,
    estateIht: estateTax / 100,
    totalCombinedIht: combinedTax / 100,
    yearSevenEstateIht: yearSevenTax / 100,
    savingsAtYearSeven: (combinedTax - yearSevenTax) / 100,
  };
}
