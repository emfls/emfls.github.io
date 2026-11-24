const maximumInsurableEarnings = 68_900;
const repaymentPercent = 30;

export const EI_2026 = Object.freeze({
  maximumInsurableEarnings,
  threshold: maximumInsurableEarnings * 1.25,
  repaymentRate: repaymentPercent / 100,
  rrspAnnualLimit: 33_810,
});

const thresholdCents = EI_2026.threshold * 100;
const rrspLimitCents = EI_2026.rrspAnnualLimit * 100;

function cents(value, label, minimum = 0, maximum = 1_000_000_000) {
  const amount = Math.round(value * 100);
  if (!Number.isFinite(value) || value < minimum || value > maximum || amount / 100 !== value) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}, with up to two decimal places.`);
  }
  return amount;
}

function repaymentStatus(regular, special, excess, priorWeeks) {
  if (regular === 0) return special > 0 ? 'special-only' : 'no-regular-benefits';
  if (excess === 0) return 'at-or-below-threshold';
  if (priorWeeks === null) return 'history-unknown';
  return priorWeeks < 1 ? 'first-time' : 'liable';
}

// Amounts are in CAD and the marginal rate is entered as a percentage (for example, 34).
// A null priorWeeks means the claimant has not confirmed their 2016–2025 history.
export function calculateEI({ netIncome, regularBenefits, specialBenefits, priorWeeks, marginalRatePercent, rrspRoom }) {
  const income = cents(netIncome, 'Net income', -1_000_000_000);
  const regular = cents(regularBenefits, 'Regular and fishing EI');
  const special = cents(specialBenefits, 'Special EI');
  const room = cents(rrspRoom, 'Available RRSP room');
  const rate = cents(marginalRatePercent, 'Marginal tax rate', 0, 100);

  if (priorWeeks !== null && (!Number.isFinite(priorWeeks) || priorWeeks < 0)) {
    throw new RangeError('Prior EI weeks must be non-negative, or null if unknown.');
  }

  const excess = Math.max(0, income - thresholdCents);
  const status = repaymentStatus(regular, special, excess, priorWeeks);
  const unknown = status === 'history-unknown';
  const liable = status === 'liable';
  const applied = liable ? Math.min(excess, room, rrspLimitCents) : 0;
  const base = liable ? Math.min(regular, excess) : 0;
  const baseAfterRRSP = liable ? Math.min(regular, excess - applied) : 0;

  // Keep repayment in hundredths of a cent until conversion to CAD.
  const repayment = base * repaymentPercent;
  const remaining = baseAfterRRSP * repaymentPercent;
  const avoided = repayment - remaining;
  const netDeduction = applied * 100 - avoided;
  const taxSaved = netDeduction * rate / 100_000_000;
  const combinedSavings = (avoided * 10_000 + netDeduction * rate) / 100_000_000;

  return {
    status,
    excessIncome: excess / 100,
    repaymentBase: unknown ? null : base / 100,
    repayment: unknown ? null : repayment / 10_000,
    afterTaxCost: unknown ? null : repayment * (10_000 - rate) / 100_000_000,
    rrspNeeded: excess / 100,
    rrspApplied: unknown ? null : applied / 100,
    incomeAfterRRSP: unknown ? null : (income - applied) / 100,
    repaymentAfterRRSP: unknown ? null : remaining / 10_000,
    grossRepaymentAvoided: unknown ? null : avoided / 10_000,
    incomeTaxSaved: unknown ? null : taxSaved,
    combinedSavings: unknown ? null : combinedSavings,
    combinedSavingsRate: applied > 0 ? combinedSavings / (applied / 100) : null,
  };
}
