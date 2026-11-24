export const IHT = Object.freeze({
  nilRateBand: 325_000,
  residenceNilRateBand: 175_000,
  taperThreshold: 2_000_000,
  standardRate: 0.40,
  charityRate: 0.36,
  charityMinimumShare: 0.10,
  pensionReformDate: '2027-04-06',
});

const MAX_AMOUNT = 1_000_000_000_000;

function validateRange(value, label, max = MAX_AMOUNT) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-GB')}.`);
  }
}

export function giftRate(yearsAgo) {
  validateRange(yearsAgo, 'Gift age');
  if (yearsAgo >= 7) return 0;
  return [0.40, 0.32, 0.24, 0.16, 0.08][Math.max(0, Math.floor(yearsAgo) - 2)];
}

/**
 * Estimate IHT for a single general estate component. Net estate already
 * deducts liabilities and excludes the comparison pension. Gift amounts
 * are net of exemptions and represent outright potentially exempt transfers.
 */
export function calculateIht({
  netEstate = 0,
  qualifyingHome = 0,
  unusedDCPensionPot = 0,
  transferredNrbPct = 0,
  transferredRnrbPct = 0,
  charityLegacy = 0,
  exemptBequests = 0,
  gifts = [],
} = {}) {
  for (const [value, label] of [
    [netEstate, 'Net estate'],
    [qualifyingHome, 'Qualifying home share'],
    [unusedDCPensionPot, 'Unused DC pension'],
    [charityLegacy, 'Charity legacy'],
    [exemptBequests, 'Other exempt bequests'],
  ]) {
    validateRange(value, label);
  }
  validateRange(transferredNrbPct, 'Transferred NRB percentage', 100);
  validateRange(transferredRnrbPct, 'Transferred RNRB percentage', 100);
  if (Math.round((qualifyingHome + charityLegacy + exemptBequests) * 100) > Math.round(netEstate * 100)) {
    throw new RangeError('The qualifying home share, charity legacy and other exempt bequests must fit within the net estate.');
  }

  const ordinaryBand = IHT.nilRateBand + IHT.nilRateBand * transferredNrbPct / 100;
  const residenceMaximum = IHT.residenceNilRateBand + IHT.residenceNilRateBand * transferredRnrbPct / 100;
  let remainingNrb = ordinaryBand;
  const giftResults = gifts
    .map(({ amount, yearsAgo }, index) => {
      validateRange(amount, 'Net gift amount');
      return { index, amount, yearsAgo, rate: giftRate(yearsAgo) };
    })
    .sort((left, right) => right.yearsAgo - left.yearsAgo)
    .map(gift => {
      const nrbUsed = gift.rate === 0 ? 0 : Math.min(gift.amount, remainingNrb);
      remainingNrb -= nrbUsed;
      const taxable = gift.rate === 0 ? 0 : gift.amount - nrbUsed;
      return { ...gift, nrbUsed, taxable, tax: taxable * gift.rate };
    });
  const giftTax = giftResults.reduce((total, gift) => total + gift.tax, 0);

  function scenario(pensionIncluded) {
    const taperEstate = netEstate + pensionIncluded;
    const taperReduction = Math.min(residenceMaximum, Math.max(0, taperEstate - IHT.taperThreshold) / 2);
    const residenceBand = Math.min(qualifyingHome, residenceMaximum - taperReduction);
    const chargeableBeforeCharity = taperEstate - exemptBequests;
    const chargeableEstate = Math.max(0, chargeableBeforeCharity - charityLegacy);

    // For the charity test the RNRB is excluded. Add back the legacy after
    // deducting at most the remaining NRB allocated to this component.
    const charityBaseline = chargeableBeforeCharity - Math.min(chargeableEstate, remainingNrb);
    const baselinePence = Math.round(charityBaseline * 100);
    const minimumPence = Math.ceil(baselinePence / (1 / IHT.charityMinimumShare));
    const charityMinimum = minimumPence / 100;
    const charityQualifies = charityLegacy > 0 && Math.round(charityLegacy * 100) >= minimumPence;
    const estateRate = charityQualifies ? IHT.charityRate : IHT.standardRate;
    const taxableEstate = Math.max(0, chargeableEstate - residenceBand - remainingNrb);
    const estateTax = taxableEstate * estateRate;

    return {
      netEstate: taperEstate, pensionIncluded, taperReduction, residenceBand,
      remainingNrb, charityBaseline, charityMinimum, charityQualifies, estateRate,
      taxableEstate, estateTax, giftTax, totalIht: estateTax + giftTax,
    };
  }

  const before = scenario(0);
  const after = scenario(unusedDCPensionPot);
  return {
    ordinaryBand, residenceMaximum, gifts: giftResults, before, after,
    extraIht: after.estateTax - before.estateTax,
    residenceBandLost: before.residenceBand - after.residenceBand,
  };
}
