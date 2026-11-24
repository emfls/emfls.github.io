/**
 * Tool 500: 2026 Canada CRA Late Payroll Remittance Penalty & Director Liability Calculator
 * Pure deterministic ESM module.
 */

export const EXEMPTION_THRESHOLD = 500; // ITA s.227(9) applies to excess over $500

export function getStatutoryPenaltyTier(daysLate, isGrossNegligence) {
  if (isGrossNegligence) {
    return { rate: 0.20, label: "20% (Gross Negligence / Willful Default)", exempts500: false };
  }
  if (daysLate <= 0) {
    return { rate: 0.00, label: "0% (On Time)", exempts500: true };
  } else if (daysLate <= 3) {
    return { rate: 0.03, label: "3% (1–3 Days Late)", exempts500: true };
  } else if (daysLate <= 5) {
    return { rate: 0.05, label: "5% (4–5 Days Late)", exempts500: true };
  } else if (daysLate <= 7) {
    return { rate: 0.07, label: "7% (6–7 Days Late)", exempts500: true };
  } else {
    return { rate: 0.10, label: "10% (>7 Days Late)", exempts500: true };
  }
}

export function calcCraLatePayrollRemittance(params) {
  const remittanceAmount = Math.max(0, Number(params.remittanceAmount ?? 40000));
  const daysLate = Math.max(0, Number(params.daysLate ?? 12));
  const isGrossNegligence = Boolean(params.isGrossNegligence ?? false);
  const annualInterestRate = Math.max(0, Number(params.annualInterestRate ?? 9.0)) / 100;
  const directorCount = Math.max(1, Number(params.directorCount ?? 2));
  const hasResignedOver2Years = Boolean(params.hasResignedOver2Years ?? false);

  const tier = getStatutoryPenaltyTier(daysLate, isGrossNegligence);

  let taxableAmountForPenalty = 0;
  let exemptionApplied = 0;

  if (tier.exempts500) {
    if (remittanceAmount > EXEMPTION_THRESHOLD) {
      exemptionApplied = EXEMPTION_THRESHOLD;
      taxableAmountForPenalty = remittanceAmount - EXEMPTION_THRESHOLD;
    } else {
      exemptionApplied = remittanceAmount;
      taxableAmountForPenalty = 0;
    }
  } else {
    // Gross negligence: NO $500 exemption
    exemptionApplied = 0;
    taxableAmountForPenalty = remittanceAmount;
  }

  const basePenalty = Math.round(taxableAmountForPenalty * tier.rate);

  // Daily compound prescribed interest under ITA s. 227(9.2)
  // Applied to both principal and penalty for the duration of the delay
  const totalArrearsBeforeInterest = remittanceAmount + basePenalty;
  let dailyInterestAmount = 0;

  if (daysLate > 0 && annualInterestRate > 0) {
    const dailyRate = annualInterestRate / 365;
    const compoundFactor = Math.pow(1 + dailyRate, daysLate);
    dailyInterestAmount = Math.round(totalArrearsBeforeInterest * (compoundFactor - 1));
  }

  const totalCrownLiability = totalArrearsBeforeInterest + dailyInterestAmount;

  // Director Joint & Several Liability under ITA s. 227.1
  let directorPersonalLiability = 0;
  let isShieldedByLimitation = false;

  if (hasResignedOver2Years) {
    directorPersonalLiability = 0;
    isShieldedByLimitation = true;
  } else {
    directorPersonalLiability = totalCrownLiability;
  }

  const perDirectorShare = Math.round(directorPersonalLiability / directorCount);

  return {
    remittanceAmount,
    daysLate,
    tierRatePercent: Math.round(tier.rate * 100),
    tierLabel: tier.label,
    exemptionApplied,
    taxableAmountForPenalty,
    basePenalty,
    dailyInterestAmount,
    totalCrownLiability,
    directorPersonalLiability,
    perDirectorShare,
    isShieldedByLimitation,
    effectivePenaltyPercent: remittanceAmount > 0 ? (basePenalty / remittanceAmount) * 100 : 0
  };
}
