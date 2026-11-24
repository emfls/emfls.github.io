export const FEDERAL_LIMIT = 500_000;
const FEDERAL_SMALL = 0.09;
const FEDERAL_GENERAL = 0.15;
const FEDERAL_PASSIVE = 0.28 + (0.10 + 2 / 300);
const REFUNDABLE_PORTION = 0.30 + 2 / 300;

const PROVINCES = {
  ON: { small: 0.032, general: 0.115, followsPassive: false },
  BC: { small: 0.02, general: 0.12, followsPassive: true },
  AB: { small: 0.02, general: 0.08, followsPassive: true },
  QC: { small: 0.032, general: 0.115, followsPassive: true },
  SK: { small: 0.01, general: 0.12, followsPassive: true, limit: 600_000 },
  NB: { small: 0.025, general: 0.14, followsPassive: false }
};

const passiveReductionAt = aaii => Math.min(FEDERAL_LIMIT, Math.max(0, aaii - 50_000) * 5);

export function calculate({
  province, aaii, activeIncome, taxableCapital = 0, includeCapital = true,
  ontarioDaysAfterJune = 184, quebecLaterYear = false
}) {
  if (!Object.hasOwn(PROVINCES, province)) throw new RangeError('Select a supported province.');
  for (const amount of [aaii, activeIncome, taxableCapital]) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
      throw new RangeError('Enter CAD amounts from 0 to 1 trillion.');
    }
  }
  if (!Number.isInteger(ontarioDaysAfterJune) || ontarioDaysAfterJune < 0 || ontarioDaysAfterJune > 365) {
    throw new RangeError('Enter 0 to 365 whole days for the Ontario rate calculation.');
  }
  if (typeof includeCapital !== 'boolean' || typeof quebecLaterYear !== 'boolean') {
    throw new RangeError('Select a valid capital or Quebec tax-year option.');
  }

  const rates = PROVINCES[province];
  let smallRate = rates.small;
  if (province === 'ON') {
    smallRate = (0.032 * (365 - ontarioDaysAfterJune) + 0.022 * ontarioDaysAfterJune) / 365;
  } else if (province === 'QC' && quebecLaterYear) {
    smallRate = 0.022;
  }

  const capitalReduction = includeCapital
    ? Math.min(FEDERAL_LIMIT, Math.max(0, taxableCapital - 10_000_000) / 80)
    : 0;
  const provincialScale = (rates.limit ?? FEDERAL_LIMIT) / FEDERAL_LIMIT;
  const federalSpread = FEDERAL_GENERAL - FEDERAL_SMALL;
  const provincialSpread = rates.general - smallRate;

  function limitsAt(passiveReduction) {
    const federal = FEDERAL_LIMIT - Math.max(capitalReduction, passiveReduction);
    const provincial = (rates.followsPassive ? federal : FEDERAL_LIMIT - capitalReduction) * provincialScale;
    return { federal, provincial };
  }

  const passiveReduction = passiveReductionAt(aaii);
  const current = limitsAt(passiveReduction);
  const baseline = limitsAt(0);
  const next = limitsAt(passiveReductionAt(aaii + 1));
  const federalSmall = Math.min(activeIncome, current.federal);
  const provincialSmall = Math.min(activeIncome, current.provincial);
  const federalShifted = Math.min(activeIncome, baseline.federal) - federalSmall;
  const provincialShifted = Math.min(activeIncome, baseline.provincial) - provincialSmall;
  const extraTax = federalShifted * federalSpread + provincialShifted * provincialSpread;

  const federalNextShift = federalSmall - Math.min(activeIncome, next.federal);
  const provincialNextShift = provincialSmall - Math.min(activeIncome, next.provincial);
  const marginalGrind = federalNextShift * federalSpread + provincialNextShift * provincialSpread;
  const directPassiveRate = FEDERAL_PASSIVE + rates.general;
  const activeTax = federalSmall * FEDERAL_SMALL + (activeIncome - federalSmall) * FEDERAL_GENERAL
    + provincialSmall * smallRate + (activeIncome - provincialSmall) * rates.general;

  return {
    federalLimit: current.federal, provincialLimit: current.provincial,
    capitalReduction, passiveReduction, federalShifted, provincialShifted,
    extraTax, activeTax, baselineActiveTax: activeTax - extraTax,
    provincialSmallRate: smallRate, smallCombinedRate: FEDERAL_SMALL + smallRate,
    generalCombinedRate: FEDERAL_GENERAL + rates.general,
    directPassiveRate, marginalGrind,
    marginalCashRate: directPassiveRate + marginalGrind,
    marginalAfterRefundRate: directPassiveRate - REFUNDABLE_PORTION + marginalGrind
  };
}
