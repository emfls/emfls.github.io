const CUTOFF = '2025-07-04';
const MAX_AMOUNT = 1e12;

export const STATE_PRESETS = Object.freeze({
  none: Object.freeze({ mode: 'conforming', rate: 0 }),
  ca: Object.freeze({ mode: 'nonconforming', rate: 0.133 }),
  pa: Object.freeze({ mode: 'nonconforming', rate: 0.0307 }),
});

function validateDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(label + ' must be a valid date.');
  }
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(label + ' must be a valid date.');
  }
}

function anniversary(value, years, extraDays = 0) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCDate(date.getUTCDate() + extraDays);
  return date.getUTCFullYear() <= 9999 ? date.toISOString().slice(0, 10) : null;
}

function validateRange(value, label, max, suffix = '') {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(label + ' must be between zero and ' + (suffix || max.toLocaleString('en-US')) + '.');
  }
}

/**
 * A sale of one lot from one issuer, with equal gain and basis allocated to
 * each independently qualifying taxpayer. All rates are decimal fractions.
 */
export function calculateQsbs({
  acquired, issued, sold, proceeds, basis, grossAssets, limitBasis = basis,
  numberOfTaxpayers = 1, priorEligibleGain = 0, marriedSeparate = false,
  otherwiseQualifies = true, ltcgRate = 0.20, ordinaryRate = 0.37,
  partialRate = 0.28, niit = true, stateMode = 'conforming', stateRate = 0,
}) {
  validateDate(acquired, 'Acquisition date');
  validateDate(issued, 'Original issue date');
  validateDate(sold, 'Sale date');
  if (acquired < '2010-09-28' || issued < '1993-08-11') {
    throw new RangeError('Use an acquisition date on or after September 28, 2010 and an issue date on or after August 11, 1993.');
  }
  if (sold < '2026-01-01') throw new RangeError('Enter a sale date in 2026 or later.');
  if (acquired > sold || issued > sold) {
    throw new RangeError('The sale date must be on or after the acquisition and issue dates.');
  }
  validateRange(proceeds, 'Sale proceeds', MAX_AMOUNT);
  validateRange(basis, 'Adjusted basis', MAX_AMOUNT);
  validateRange(limitBasis, 'Basis for the 10× limit', MAX_AMOUNT);
  validateRange(grossAssets, 'Issuer gross assets', MAX_AMOUNT);
  validateRange(priorEligibleGain, 'Previously counted eligible gain', MAX_AMOUNT);
  if (!Number.isSafeInteger(numberOfTaxpayers) || numberOfTaxpayers < 1 || numberOfTaxpayers > 1000) {
    throw new RangeError('Number of taxpayers must be a whole number from 1 to 1,000.');
  }
  validateRange(ltcgRate, 'Regular federal long-term rate', 0.2, '20%');
  validateRange(ordinaryRate, 'Federal ordinary rate', 0.37, '37%');
  validateRange(partialRate, 'Federal QSBS partial rate', 0.28, '28%');
  validateRange(stateRate, 'State rate', 1, '100%');
  if (stateMode !== 'conforming' && stateMode !== 'nonconforming') {
    throw new RangeError('Select a valid state conformity mode.');
  }

  const expanded = acquired > CUTOFF;
  const assetCeiling = issued > CUTOFF ? 75_000_000 : 50_000_000;
  const passesAssetTest = grossAssets <= assetCeiling;
  const passesEligibilityScreen = passesAssetTest && otherwiseQualifies;
  // ISO date comparisons support day-level thresholds without local timezone effects.
  const tiers = expanded
    ? [[anniversary(acquired, 3), 0.5], [anniversary(acquired, 4), 0.75], [anniversary(acquired, 5), 1]]
    : [[anniversary(acquired, 5, 1), 1]];
  const reachedTiers = tiers.filter(([date]) => date !== null && date <= sold);
  const exclusionRate = passesEligibilityScreen ? (reachedTiers.at(-1)?.[1] ?? 0) : 0;
  const nextTierDate = passesEligibilityScreen ? (tiers[reachedTiers.length]?.[0] ?? null) : null;

  const baseDollarLimit = (expanded ? 15_000_000 : 10_000_000) / (marriedSeparate ? 2 : 1);
  const dollarLimit = Math.max(0, baseDollarLimit - priorEligibleGain) * numberOfTaxpayers;
  const basisLimit = 10 * limitBasis;
  const cap = Math.max(dollarLimit, basisLimit);
  const gain = proceeds - basis;
  const positiveGain = Math.max(0, gain);
  const eligibleGain = exclusionRate > 0 ? Math.min(positiveGain, cap) : 0;
  const excludedGain = eligibleGain * exclusionRate;
  const partialTaxableGain = eligibleGain - excludedGain;
  const regularTaxableGain = positiveGain - eligibleGain;
  const longTermDate = anniversary(acquired, 1, 1);
  const longTerm = longTermDate !== null && sold >= longTermDate;
  const regularFederalRate = longTerm ? ltcgRate : ordinaryRate;
  const niitRate = niit ? 0.038 : 0;
  const taxableGain = partialTaxableGain + regularTaxableGain;
  const federalTax = partialTaxableGain * partialRate
    + regularTaxableGain * regularFederalRate + taxableGain * niitRate;
  const baselineFederalTax = positiveGain * (regularFederalRate + niitRate);
  const stateTax = (stateMode === 'conforming' ? taxableGain : positiveGain) * stateRate;
  const totalTax = federalTax + stateTax;
  const stateSavings = stateMode === 'conforming' ? excludedGain * stateRate : 0;
  const savings = excludedGain * (regularFederalRate + niitRate)
    + partialTaxableGain * (regularFederalRate - partialRate) + stateSavings;

  return {
    regime: expanded ? 'expanded' : 'legacy', assetCeiling, passesAssetTest,
    passesEligibilityScreen, longTerm, nextTierDate, exclusionRate, gain,
    dollarLimit, basisLimit, cap, eligibleGain, excludedGain, partialTaxableGain,
    regularTaxableGain, federalTax, baselineFederalTax, stateTax, totalTax, savings,
    effectiveFederalRate: positiveGain ? federalTax / positiveGain : 0,
  };
}
