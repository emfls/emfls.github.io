export const FILING_RULES = Object.freeze({
  mfj: Object.freeze({ threshold: 403500, phaseInRange: 150000 }),
  single: Object.freeze({ threshold: 201775, phaseInRange: 75000 }),
  hoh: Object.freeze({ threshold: 201750, phaseInRange: 75000 }),
  mfs: Object.freeze({ threshold: 201775, phaseInRange: 75000 }),
});

export const QBI_RATE = 0.20;
export const ACTIVE_QBI_MINIMUM = 1000;
export const MINIMUM_DEDUCTION = 400;

const nonnegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const clampRatio = value => Math.min(1, Math.max(0, value));
const wageLimit = (wages, property) => Math.max(0.50 * wages, 0.25 * wages + 0.025 * property);

/**
 * Estimates one business plus eligible, net REIT/PTP income for 2026.
 * Dollar inputs are numbers and marginalRate is a fraction (0.24 means 24%).
 * Follows the requested Single threshold and cap on the active minimum.
 */
export function calculateQbi(input) {
  const {
    filingStatus, businessType, taxableIncomeBeforeQbi, qbi, w2Wages,
    ubiaProperty, reitPtpIncome, netCapitalGains, isActiveMaterialParticipant, marginalRate,
  } = input ?? {};
  const { threshold, phaseInRange } = typeof filingStatus === 'string' && Object.hasOwn(FILING_RULES, filingStatus)
    ? FILING_RULES[filingStatus]
    : FILING_RULES.single;
  const phaseInUpper = threshold + phaseInRange;
  const taxableIncome = nonnegative(taxableIncomeBeforeQbi);
  const qualifiedIncome = nonnegative(qbi);
  const wages = nonnegative(w2Wages);
  const property = nonnegative(ubiaProperty);
  const isSstb = businessType === 'sstb';

  const phaseInRatio = clampRatio((taxableIncome - threshold) / phaseInRange);
  const applicablePercentage = isSstb ? 1 - phaseInRatio : 1;
  const tentativeQbi = QBI_RATE * qualifiedIncome;
  const wageUbiaCap = wageLimit(wages, property);
  const eligibleTentative = QBI_RATE * (qualifiedIncome * applicablePercentage);
  const eligibleWageCap = wageLimit(wages * applicablePercentage, property * applicablePercentage);
  const wageExcess = Math.max(0, eligibleTentative - eligibleWageCap);
  const wageLimited = phaseInRatio > 0 && wageExcess > 0;
  const businessComponent = phaseInRatio === 1
    ? Math.min(eligibleTentative, eligibleWageCap)
    : eligibleTentative - phaseInRatio * wageExcess;

  const reitComponent = QBI_RATE * nonnegative(reitPtpIncome);
  const overallCap = QBI_RATE * Math.max(0, taxableIncome - nonnegative(netCapitalGains));
  const preliminaryDeduction = Math.min(businessComponent + reitComponent, overallCap);
  const floorEligible = isActiveMaterialParticipant === true && qualifiedIncome >= ACTIVE_QBI_MINIMUM
    && applicablePercentage > 0;
  const effectiveFloor = floorEligible ? Math.min(MINIMUM_DEDUCTION, overallCap) : 0;
  const finalDeduction = Math.max(preliminaryDeduction, effectiveFloor);

  // Either wage test can meet the tentative deduction. SSTB scaling cancels on both sides.
  const wageTarget = Math.min(2 * tentativeQbi, 4 * (tentativeQbi - 0.025 * property));
  const additionalW2Wages = wageLimited ? Math.max(0, wageTarget - wages) : 0;
  const deductionWithWageLimitRemoved = Math.max(effectiveFloor, Math.min(eligibleTentative + reitComponent, overallCap));

  return {
    threshold, phaseInUpper, phaseInRatio, applicablePercentage, tentativeQbi, wageUbiaCap,
    eligibleWageCap, businessComponent, reitComponent, overallCap, preliminaryDeduction,
    floorEligible, effectiveFloor, floorApplied: finalDeduction > preliminaryDeduction,
    finalDeduction, estimatedTaxSavings: finalDeduction * clampRatio(nonnegative(marginalRate)),
    wageLimited, additionalW2Wages, deductionWithWageLimitRemoved,
  };
}
