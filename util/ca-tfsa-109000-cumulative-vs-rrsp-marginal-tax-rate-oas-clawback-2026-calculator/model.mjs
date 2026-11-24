export const TFSA_LIMITS = Object.freeze({
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500, 2015: 10000,
  2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500, 2024: 7000, 2025: 7000, 2026: 7000,
});

export const RRSP_CAP_2026 = 33810;
export const RRSP_EARNED_INCOME_RATE = 0.18;
export const OAS_THRESHOLD_2026 = 95323;
export const CLAWBACK_RATES = Object.freeze({ NONE: 0, OAS_CLAWBACK: 15, GIS_CLAWBACK: 50 });

export function cumulativeTfsaRoom(birthYear, residencyStartYear) {
  if (![birthYear, residencyStartYear].every(year => Number.isSafeInteger(year) && year > 0)) {
    throw new RangeError('Enter valid whole years for birth and residency.');
  }
  const firstYear = Math.max(2009, birthYear + 18, residencyStartYear);
  return Object.entries(TFSA_LIMITS).reduce(
    (room, [year, limit]) => Number(year) >= firstYear ? room + limit : room, 0,
  );
}

export function compareAccounts({
  preTax, workRate, retirementRate, clawback, refundBehavior, annualReturn, years,
}) {
  if (!Number.isFinite(preTax) || preTax < 0) {
    throw new RangeError('Enter a non-negative pre-tax investment amount.');
  }
  if (![workRate, retirementRate].every(rate => Number.isFinite(rate) && rate >= 0 && rate <= 100)) {
    throw new RangeError('Enter both marginal tax rates between 0% and 100%.');
  }
  if (!Object.hasOwn(CLAWBACK_RATES, clawback)) {
    throw new RangeError('Choose a retirement clawback scenario.');
  }
  if (!['REINVEST_REFUND', 'SPEND_REFUND'].includes(refundBehavior)) {
    throw new RangeError('Choose an RRSP refund option.');
  }
  if (!Number.isFinite(annualReturn) || annualReturn < -100 || !Number.isFinite(years) || years < 0) {
    throw new RangeError('Enter an annual return of at least −100% and a non-negative investment period.');
  }

  const clawbackRate = CLAWBACK_RATES[clawback];
  const effectiveRetirementRate = retirementRate + clawbackRate;
  if (effectiveRetirementRate > 100) {
    throw new RangeError('The retirement tax rate plus the selected clawback must be 100% or less.');
  }

  const reinvest = refundBehavior === 'REINVEST_REFUND';
  const growth = (1 + annualReturn / 100) ** years;
  const tfsaContribution = preTax * ((100 - workRate) / 100);
  const rrspContribution = reinvest ? preTax : tfsaContribution;
  const tfsaFinal = tfsaContribution * growth;
  const rrspGross = rrspContribution * growth;
  const rrspFinal = rrspGross * ((100 - effectiveRetirementRate) / 100);
  const clawbackPenalty = rrspGross * (clawbackRate / 100);
  if (![tfsaFinal, rrspGross, rrspFinal].every(Number.isFinite)) {
    throw new RangeError('These inputs are too large to calculate.');
  }

  // Factor out growth to make the tie and rate advantage independent of compounding.
  const rateSpread = reinvest ? workRate - effectiveRetirementRate : -effectiveRetirementRate;
  const signedAdvantage = Math.abs(rateSpread) <= 1e-12 ? 0 : rrspGross * (rateSpread / 100);
  const breakEvenEffectiveRate = rrspGross === 0 ? null : reinvest ? workRate : 0;
  return {
    tfsaContribution,
    rrspContribution,
    tfsaFinal,
    rrspFinal,
    effectiveRetirementRate,
    winner: signedAdvantage > 0 ? 'RRSP' : signedAdvantage < 0 ? 'TFSA' : 'TIE',
    advantage: Math.abs(signedAdvantage),
    clawbackPenalty,
    refundSpent: reinvest ? 0 : rrspContribution * (workRate / 100),
    breakEvenEffectiveRate,
    breakEvenBaseRate: breakEvenEffectiveRate === null ? null : breakEvenEffectiveRate - clawbackRate,
  };
}
