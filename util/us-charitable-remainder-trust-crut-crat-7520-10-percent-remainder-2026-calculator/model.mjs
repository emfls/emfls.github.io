export const STATUS = Object.freeze({
  invalidPayout: 'INVALID_PAYOUT_RATE',
  invalidTerm: 'INVALID_TERM_YEARS',
  invalidInput: 'INVALID_INPUT',
  pass: 'PASS_10_PCT_MRI',
  fail: 'FAIL_DISQUALIFIED_CRT',
});

const MIN_REMAINDER = 0.10;
const AGI_CAP = 0.30;
const AGI_FLOOR = 0.005;

const between = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

// Rates are decimal fractions. Payments occur annually at year-end.
export function annuityFactor(rate, termYears) {
  return rate === 0 ? termYears : -Math.expm1(-termYears * Math.log1p(rate)) / rate;
}

export function remainderFactors(payoutRate, section7520Rate, termYears) {
  const adjustedPayoutRate = payoutRate / (1 + section7520Rate);
  const cratAnnuityShare = payoutRate * annuityFactor(section7520Rate, termYears);
  return {
    adjustedPayoutRate,
    crut: (1 - adjustedPayoutRate) ** termYears,
    crat: Math.max(0, 1 - cratAnnuityShare),
    cratAnnuityShare,
  };
}

function projectTrust(type, fmv, payoutRate, annualReturn, termYears) {
  let balance = fmv;
  let totalPayout = 0;
  let firstPayout = 0;
  let firstShortfallYear = null;
  for (let year = 1; year <= termYears; year++) {
    const scheduled = (type === 'crut' ? balance : fmv) * payoutRate;
    const available = balance * (1 + annualReturn);
    const paid = Math.min(scheduled, available);
    if (paid < scheduled && firstShortfallYear === null) firstShortfallYear = year;
    if (year === 1) firstPayout = paid;
    totalPayout += paid;
    balance = available - paid;
  }
  return { firstPayout, totalPayout, finalGift: balance, firstShortfallYear };
}

export function calculateCRT({
  fmv, costBasis, agi, payoutRate, termYears, section7520Rate, annualReturn,
  fedLtcgRate, niitRate, stateRate, marginalRate,
}) {
  if (!between(payoutRate, 0.05, 0.50)) return { error: STATUS.invalidPayout };
  if (!Number.isInteger(termYears) || !between(termYears, 1, 20)) return { error: STATUS.invalidTerm };

  const totalGainRate = fedLtcgRate + niitRate + stateRate;
  if (!between(fmv, 0.01, 1e12) || !between(costBasis, 0, 1e12) ||
      !between(agi, 0, 1e12) || !between(section7520Rate, 0, 1) ||
      !between(annualReturn, -1, 1) || !between(fedLtcgRate, 0, 0.20) ||
      !between(niitRate, 0, 0.038) || !between(stateRate, 0, 1) ||
      !between(marginalRate, 0, 1) || !between(totalGainRate, 0, 1)) {
    return { error: STATUS.invalidInput };
  }

  const gain = Math.max(0, fmv - costBasis);
  const taxDrag = gain * totalGainRate;
  const netSaleProceeds = fmv - taxDrag;
  const factors = remainderFactors(payoutRate, section7520Rate, termYears);
  const deductionCap = agi * AGI_CAP;
  const deductionFloor = agi * AGI_FLOOR;
  const cratExhaustion = payoutRate > section7520Rate && factors.cratAnnuityShare >= 1;
  const cratExhaustionWarning = payoutRate > section7520Rate && factors.crat <= 0.05;

  function scenario(type) {
    const remainderFactor = factors[type];
    // Absorb floating-point noise at an exact statutory boundary.
    const passes = remainderFactor >= MIN_REMAINDER - 2 * Number.EPSILON;
    const remainderPV = fmv * remainderFactor;
    const upfrontDeduction = passes ? remainderPV : null;
    const beforeFloor = Math.min(upfrontDeduction ?? 0, deductionCap);
    const floorReduction = Math.min(beforeFloor, deductionFloor);
    const year1Deduction = passes ? beforeFloor - floorReduction : null;
    const carryforward = passes
      ? (upfrontDeduction > deductionCap ? upfrontDeduction - deductionCap + floorReduction : 0)
      : null;
    return {
      status: passes ? STATUS.pass : STATUS.fail,
      remainderFactor,
      remainderPV,
      upfrontDeduction,
      year1Deduction,
      year1TaxSavings: passes ? year1Deduction * marginalRate : null,
      carryforward,
      immediateTaxDeferred: passes ? taxDrag : null,
      ...projectTrust(type, fmv, payoutRate, annualReturn, termYears),
    };
  }

  return {
    gain, taxDrag, netSaleProceeds, deductionCap, deductionFloor,
    outrightFinalBalance: netSaleProceeds * (1 + annualReturn) ** termYears,
    cratExhaustion, cratExhaustionWarning,
    crut: scenario('crut'),
    crat: scenario('crat'),
  };
}
