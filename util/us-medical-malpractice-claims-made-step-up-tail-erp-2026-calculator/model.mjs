/**
 * Tool 497: 2026 US Medical Malpractice Insurance Economics Calculator
 * Pure deterministic ESM module.
 */

export const STEP_UP_FACTORS = [0.55, 0.72, 0.83, 0.92, 1.00];

export function getClaimsMadeRate(matureRate, yearIndex) {
  if (yearIndex <= 0) return 0;
  const factor = yearIndex <= 5 ? STEP_UP_FACTORS[yearIndex - 1] : 1.00;
  return Math.round(matureRate * factor);
}

export function calcMalpracticeComparison(params) {
  const matureRate = Math.max(1000, Number(params.matureRate ?? 30000));
  const occurrenceMultiplier = Math.max(1.0, Number(params.occurrenceMultiplier ?? 1.20));
  const tailMultiplier = Math.max(1.0, Number(params.tailMultiplier ?? 2.00));
  const plannedTenureYears = Math.min(20, Math.max(1, Number(params.plannedTenureYears ?? 5)));
  const qualifiesForFreeTail = Boolean(params.qualifiesForFreeTail ?? false);

  const annualOccurrencePremium = Math.round(matureRate * occurrenceMultiplier);

  const schedule = [];
  let cumCmPremium = 0;
  let cumOccPremium = 0;

  for (let yr = 1; yr <= 10; yr++) {
    const cmAnnual = getClaimsMadeRate(matureRate, yr);
    cumCmPremium += cmAnnual;
    cumOccPremium += annualOccurrencePremium;

    // Tail cost if leaving at end of year yr
    let tailCost = 0;
    if (!qualifiesForFreeTail || yr < 5) {
      tailCost = Math.round(cmAnnual * tailMultiplier);
    }

    const totalCmWithTail = cumCmPremium + tailCost;
    const diff = totalCmWithTail - cumOccPremium; // >0 means Occurrence is cheaper, <0 means CM is cheaper

    schedule.push({
      year: yr,
      cmAnnual,
      cumCmPremium,
      tailCost,
      totalCmWithTail,
      occAnnual: annualOccurrencePremium,
      cumOccPremium,
      diff,
      favoredPolicy: diff < 0 ? "Claims-Made" : (diff > 0 ? "Occurrence" : "Tie")
    });
  }

  const tenureRow = schedule[plannedTenureYears - 1];
  const breakevenRow = schedule.find(r => r.diff > 0);
  const breakevenYear = breakevenRow ? breakevenRow.year : null;

  return {
    matureRate,
    annualOccurrencePremium,
    tailMultiplier,
    plannedTenureYears,
    qualifiesForFreeTail,
    tenureSummary: {
      year: plannedTenureYears,
      cumCmPremium: tenureRow.cumCmPremium,
      tailCost: tenureRow.tailCost,
      totalCmWithTail: tenureRow.totalCmWithTail,
      cumOccPremium: tenureRow.cumOccPremium,
      netDifference: tenureRow.diff,
      recommended: tenureRow.favoredPolicy
    },
    breakevenYear,
    schedule
  };
}
