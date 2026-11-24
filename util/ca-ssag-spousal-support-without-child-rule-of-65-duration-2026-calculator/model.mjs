/**
 * Tool 484: 2026 Canada Spousal Support Advisory Guidelines (SSAG) Calculator
 * Pure deterministic ESM module.
 */

export const SSAG_RATE_LOW_PER_YEAR = 0.015;  // 1.5% per year of cohabitation
export const SSAG_RATE_MID_PER_YEAR = 0.0175; // 1.75% per year
export const SSAG_RATE_HIGH_PER_YEAR = 0.020; // 2.0% per year
export const SSAG_MAX_LOW_PERCENT = 0.375;    // 37.5% maximum cap (reached at 25 years)
export const SSAG_MAX_MID_PERCENT = 0.4375;   // 43.75% maximum cap
export const SSAG_MAX_HIGH_PERCENT = 0.50;    // 50.0% maximum cap

/**
 * Calculates SSAG "Without Child Support" Quantum & Duration
 */
export function calcCanadaSsagWithoutChild(params) {
  const payorGrossIncome = Math.max(0, Number(params.payorGrossIncome) || 0);
  const recipientGrossIncome = Math.max(0, Number(params.recipientGrossIncome) || 0);
  const yearsCohabitation = Math.max(0, Number(params.yearsCohabitation) || 0);
  const recipientAgeAtSeparation = Math.max(0, Number(params.recipientAgeAtSeparation) || 0);

  // 1. Gross Income Difference
  const grossIncomeDifference = Math.max(0, payorGrossIncome - recipientGrossIncome);

  // 2. Quantum Percentages (1.5% to 2.0% per year of marriage/cohabitation)
  const lowPercent = Math.min(SSAG_MAX_LOW_PERCENT, yearsCohabitation * SSAG_RATE_LOW_PER_YEAR);
  const midPercent = Math.min(SSAG_MAX_MID_PERCENT, yearsCohabitation * SSAG_RATE_MID_PER_YEAR);
  const highPercent = Math.min(SSAG_MAX_HIGH_PERCENT, yearsCohabitation * SSAG_RATE_HIGH_PER_YEAR);

  // 3. Annual and Monthly Dollar Amounts
  const annualLow = Math.round(grossIncomeDifference * lowPercent);
  const annualMid = Math.round(grossIncomeDifference * midPercent);
  const annualHigh = Math.round(grossIncomeDifference * highPercent);

  const monthlyLow = Math.round(annualLow / 12);
  const monthlyMid = Math.round(annualMid / 12);
  const monthlyHigh = Math.round(annualHigh / 12);

  // 4. Duration Determination
  // Standard rule: 0.5 to 1.0 years of support per year of relationship
  const minDurationYears = Math.round((yearsCohabitation * 0.5) * 10) / 10;
  const maxDurationYears = Math.round((yearsCohabitation * 1.0) * 10) / 10;
  const minDurationMonths = Math.round(yearsCohabitation * 0.5 * 12);
  const maxDurationMonths = Math.round(yearsCohabitation * 1.0 * 12);

  // 5. Indefinite Support Exceptions ("Rule of 20" & "Rule of 65")
  // Rule of 20: Marriage 20+ years -> Indefinite
  const triggersRuleOf20 = yearsCohabitation >= 20;

  // Rule of 65: Marriage >= 5 years AND (Recipient Age + Years of Marriage >= 65)
  const agePlusYears = recipientAgeAtSeparation + yearsCohabitation;
  const triggersRuleOf65 = yearsCohabitation >= 5 && agePlusYears >= 65;

  const isIndefinite = triggersRuleOf20 || triggersRuleOf65;

  let indefiniteReason = '';
  if (triggersRuleOf20 && triggersRuleOf65) {
    indefiniteReason = 'Indefinite Support: Triggers both 20-Year Marriage Rule and Rule of 65 (Age ' + recipientAgeAtSeparation + ' + ' + yearsCohabitation + ' yrs = ' + agePlusYears + ' >= 65).';
  } else if (triggersRuleOf20) {
    indefiniteReason = 'Indefinite Support: Long relationship rule (20+ years of cohabitation).';
  } else if (triggersRuleOf65) {
    indefiniteReason = 'Indefinite Support: Rule of 65 satisfied (Recipient Age ' + recipientAgeAtSeparation + ' + ' + yearsCohabitation + ' yrs = ' + agePlusYears + ' >= 65; minimum 5 years met).';
  } else {
    indefiniteReason = 'Time-Limited Support: Duration ranges from ' + minDurationYears + ' to ' + maxDurationYears + ' years (' + minDurationMonths + ' to ' + maxDurationMonths + ' months).';
  }

  // 6. Net Post-Support Equalisation Ratio
  const payorNetAfterMid = payorGrossIncome - annualMid;
  const recipientNetAfterMid = recipientGrossIncome + annualMid;
  const totalCombined = payorGrossIncome + recipientGrossIncome;
  const recipientShareOfCombined = totalCombined > 0 ? Math.round((recipientNetAfterMid / totalCombined) * 1000) / 10 : 0;

  return {
    payorGrossIncome,
    recipientGrossIncome,
    yearsCohabitation,
    recipientAgeAtSeparation,
    grossIncomeDifference,
    lowPercent: Math.round(lowPercent * 1000) / 10,
    midPercent: Math.round(midPercent * 1000) / 10,
    highPercent: Math.round(highPercent * 1000) / 10,
    annualLow,
    annualMid,
    annualHigh,
    monthlyLow,
    monthlyMid,
    monthlyHigh,
    minDurationYears,
    maxDurationYears,
    minDurationMonths,
    maxDurationMonths,
    agePlusYears,
    triggersRuleOf20,
    triggersRuleOf65,
    isIndefinite,
    indefiniteReason,
    payorNetAfterMid,
    recipientNetAfterMid,
    recipientShareOfCombined
  };
}
