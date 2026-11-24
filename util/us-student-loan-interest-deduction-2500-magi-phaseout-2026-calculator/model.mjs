export const MAX_DEDUCTION = 2500;
export const FEDERAL_RATES = Object.freeze([10, 12, 22, 24, 32, 35, 37]);

const individualWindow = Object.freeze([85000, 100000]);
export const MAGI_WINDOWS = Object.freeze({
  single: individualWindow,
  hoh: individualWindow,
  qss: individualWindow,
  mfj: Object.freeze([175000, 205000]),
  mfs: null,
});

function validateNumber(value, label, min, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
}

function phaseoutFraction(magi, [start, end]) {
  return Math.max(0, Math.min(1, (magi - start) / (end - start)));
}

export function calculateDeduction({
  filingStatus, dependent, interestPaid, magi, federalRate, stateRate,
  contribution = 0, loanRate = null,
}) {
  if (!Object.hasOwn(MAGI_WINDOWS, filingStatus) || typeof dependent !== 'boolean') {
    throw new RangeError('Choose a valid filing and dependency status.');
  }
  validateNumber(interestPaid, 'amount of qualified interest (zero or more)', 0);
  validateNumber(magi, 'MAGI', -Infinity);
  if (!FEDERAL_RATES.includes(federalRate)) {
    throw new RangeError('Choose a federal marginal tax rate.');
  }
  validateNumber(stateRate, 'state rate from 0% to 13.3%', 0, 13.3);
  validateNumber(contribution, 'contribution (zero or more)', 0);
  if (loanRate !== null) validateNumber(loanRate, 'loan rate from 0% to 100%', 0, 100);

  const cappedInterest = Math.min(interestPaid, MAX_DEDUCTION);
  const adjustedMagi = magi - contribution;
  validateNumber(adjustedMagi, 'MAGI after contributions', -Infinity);

  const window = MAGI_WINDOWS[filingStatus];
  const disqualificationReasons = [];
  if (!window) disqualificationReasons.push('mfs');
  if (dependent) disqualificationReasons.push('dependent');
  const disqualified = disqualificationReasons.length > 0;
  const disqualificationLoss = disqualified ? cappedInterest : 0;
  const phaseoutLoss = disqualified ? 0 : cappedInterest * phaseoutFraction(adjustedMagi, window);
  const allowedDeduction = cappedInterest - disqualificationLoss - phaseoutLoss;
  const baselineDeduction = disqualified ? 0 : cappedInterest - cappedInterest * phaseoutFraction(magi, window);

  const federalSavings = allowedDeduction * (federalRate / 100);
  const stateSavings = allowedDeduction * (stateRate / 100);
  const totalSavings = federalSavings + stateSavings;
  const extraSavings = Math.max(0, allowedDeduction - baselineDeduction) * ((federalRate + stateRate) / 100);
  const interestRelief = interestPaid > 0 ? totalSavings / interestPaid : null;
  const rateRelief = loanRate === null || interestRelief === null ? null : loanRate * interestRelief;

  return {
    cappedInterest, adjustedMagi, baselineDeduction, allowedDeduction, phaseoutLoss,
    disqualificationLoss, disqualificationReasons, federalSavings, stateSavings,
    totalSavings, extraSavings,
    interestReliefPercent: interestRelief === null ? null : 100 * interestRelief,
    rateRelief,
    afterTaxRate: rateRelief === null ? null : loanRate - rateRelief,
  };
}
