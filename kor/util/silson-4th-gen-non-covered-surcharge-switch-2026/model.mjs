export const MAX_WON = 1_000_000_000;

export const TIERS = Object.freeze([
  { level: 1, minimum: 0, multiplier: 0.95, label: '약 5% 할인' },
  { level: 2, minimum: 1, multiplier: 1, label: '변동 없음' },
  { level: 3, minimum: 1_000_000, multiplier: 2, label: '+100% 할증' },
  { level: 4, minimum: 1_500_000, multiplier: 3, label: '+200% 할증' },
  { level: 5, minimum: 3_000_000, multiplier: 4, label: '+300% 할증' },
].map(Object.freeze));

export const OLD_PRESETS = Object.freeze({
  1: Object.freeze([0, 0]),
  2: Object.freeze([10, 20]),
  3: Object.freeze([10, 20]),
});

const COVERED_BP = 2_000;
const RIDER_BP = 3_000;
const RATE_SCALE = 10_000;

function validateWon(value, max = MAX_WON) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError('금액은 허용 범위의 0 이상 정수여야 합니다.');
  }
}

function basisPoints(rate) {
  const points = Math.round(rate * 100);
  if (rate !== points / 100 || points < 0 || points > RATE_SCALE) {
    throw new RangeError('자기부담률은 0~100% 사이의 소수 둘째 자리 이하여야 합니다.');
  }
  return points;
}

export function getTier(paid, excluded = 0) {
  validateWon(paid, 2 * MAX_WON);
  validateWon(excluded, paid);
  return TIERS.findLast(({ minimum }) => paid - excluded >= minimum);
}

export function estimatePremium(coveredMonthly, riderMonthly, tier) {
  validateWon(coveredMonthly);
  validateWon(riderMonthly);
  if (!TIERS.includes(tier)) throw new RangeError('유효한 할인·할증 등급이 필요합니다.');
  const rider = Math.round(riderMonthly * tier.multiplier);
  const monthly = coveredMonthly + rider;
  return { rider, monthly, annual: 12 * monthly };
}

export function compareAnnualCosts({
  oldMonthly, oldCoveredRate, oldRiderRate, coveredBills, riderBills, newAnnual,
}) {
  validateWon(oldMonthly);
  validateWon(coveredBills);
  validateWon(riderBills);
  validateWon(newAnnual, 60 * MAX_WON);
  const oldAnnual = 12 * oldMonthly;
  const oldCopay = Math.round(
    (coveredBills * basisPoints(oldCoveredRate) + riderBills * basisPoints(oldRiderRate)) / RATE_SCALE,
  );
  const newCopay = Math.round((coveredBills * COVERED_BP + riderBills * RIDER_BP) / RATE_SCALE);
  const oldTotal = oldAnnual + oldCopay;
  const newTotal = newAnnual + newCopay;
  return { oldAnnual, oldCopay, newCopay, oldTotal, newTotal, savings: oldTotal - newTotal };
}

// Keep the renewal tier and covered bills constant while varying non-covered bills.
export function nonCoveredBreakEven({
  oldMonthly, oldCoveredRate, oldRiderRate, coveredBills, newAnnual,
}) {
  validateWon(oldMonthly);
  validateWon(coveredBills);
  validateWon(newAnnual, 60 * MAX_WON);
  const numerator = (12 * oldMonthly - newAnnual) * RATE_SCALE
    + (basisPoints(oldCoveredRate) - COVERED_BP) * coveredBills;
  const rateGap = RIDER_BP - basisPoints(oldRiderRate);
  if (numerator === 0 && rateGap === 0) return { kind: 'all' };
  if (rateGap !== 0 && numerator / rateGap >= 0) {
    return { kind: 'point', amount: Math.round(numerator / rateGap) };
  }
  return { kind: 'none', savingsAtZero: numerator / RATE_SCALE };
}

export function compareClaim(paid, additional, excluded, additionalExempt, coveredMonthly, riderMonthly) {
  validateWon(paid);
  validateWon(additional);
  const before = getTier(paid, excluded);
  const after = getTier(paid + additional, excluded + (additionalExempt ? additional : 0));
  const beforePremium = estimatePremium(coveredMonthly, riderMonthly, before);
  const afterPremium = estimatePremium(coveredMonthly, riderMonthly, after);
  const extraPremium = afterPremium.annual - beforePremium.annual;
  return { before, after, beforePremium, afterPremium, extraPremium, net: additional - extraPremium };
}
