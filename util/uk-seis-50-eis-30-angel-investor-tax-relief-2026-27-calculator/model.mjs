const SEIS_LIMIT = 200_000;
const EIS_LIMIT = 1_000_000;
const CGT_ALLOWANCE = 3_000;
const MAX_AMOUNT = 100_000_000;
const LOSS_RATES = [0, 0.19, 0.20, 0.21, 0.40, 0.42, 0.45, 0.48];
const CGT_RATES = [0.18, 0.24];

function validateRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-GB')} and ${max.toLocaleString('en-GB')}.`);
  }
}

export function calculate({
  investment, incomeTaxLiability, lossIncome, lossRate, cgtRate,
  exitAllowance, kicInvestment, seisGain, eisGain, exitMultiple,
}) {
  validateRange(investment, 0.01, MAX_AMOUNT, 'Investment');
  validateRange(incomeTaxLiability, 0, MAX_AMOUNT, 'Available Income Tax liability');
  validateRange(lossIncome, 0, MAX_AMOUNT, 'Income available for loss relief');
  validateRange(exitAllowance, 0, CGT_ALLOWANCE, 'Unused exit CGT allowance');
  validateRange(kicInvestment, 0, investment, 'EIS knowledge-intensive investment');
  validateRange(seisGain, 0, MAX_AMOUNT, 'Eligible SEIS gain');
  validateRange(eisGain, 0, MAX_AMOUNT, 'Eligible EIS gain');
  validateRange(exitMultiple, 3, 10, 'Upside exit multiple');
  if (!LOSS_RATES.includes(lossRate)) throw new RangeError('Choose an available loss-relief rate.');
  if (!CGT_RATES.includes(cgtRate)) throw new RangeError('Choose an available CGT rate.');

  function compare(rate, eligibleInvestment, reinvestmentGain = 0, deferredGain = 0) {
    const incomeTaxRelief = Math.min(eligibleInvestment * rate, incomeTaxLiability);
    const netExposure = investment - incomeTaxRelief;
    const exemptGain = incomeTaxRelief > 0 ? Math.min(reinvestmentGain, eligibleInvestment) * 0.5 : 0;
    const cgtSaving = exemptGain * cgtRate;
    const cgtDeferred = deferredGain * cgtRate;
    // Model distinct relieved shares at the same unit cost. A positive claim
    // limited solely by liability still exempts gains on those shares.
    const taxableFraction = incomeTaxRelief > 0 ? (investment - eligibleInvestment) / investment : 1;

    const scenarios = [0, 1, exitMultiple].map(multiple => {
      const proceeds = investment * multiple;
      const allowableLoss = Math.max(0, netExposure - proceeds);
      const lossRelief = rate > 0 ? Math.min(allowableLoss, lossIncome) * lossRate : 0;
      const taxableShareGain = Math.max(0, proceeds - investment) * taxableFraction;
      const shareCgt = Math.max(0, taxableShareGain - exitAllowance) * cgtRate;
      const revivedTax = cgtDeferred;
      // Nominal cash flows use a constant CGT rate and assume no offsets on the revived gain.
      const netProfit = proceeds - investment + incomeTaxRelief + cgtSaving + lossRelief - shareCgt
        + (cgtDeferred - revivedTax);
      return {
        multiple, proceeds, allowableLoss, lossRelief, shareCgt, revivedTax, netProfit,
        netMultiple: 1 + netProfit / investment,
      };
    });

    return {
      eligibleInvestment, incomeTaxRelief, netExposure, exemptGain, cgtSaving, deferredGain,
      cgtDeferred, scenarios, downsideRisk: Math.max(0, -scenarios[0].netProfit / investment),
    };
  }

  const seisEligible = Math.min(investment, SEIS_LIMIT);
  const eisEligible = Math.min(investment, EIS_LIMIT + Math.min(kicInvestment, EIS_LIMIT));

  return {
    seis: compare(0.5, seisEligible, seisGain),
    eis: compare(0.3, eisEligible, 0, Math.min(eisGain, investment)),
    taxable: compare(0, 0),
  };
}
