export const RECOVERY_PERIODS = Object.freeze({
  2025: Object.freeze({ payments: 'July 2026 – June 2027', threshold: 93454, full65: 152062, full75: 157923 }),
  2026: Object.freeze({ payments: 'July 2027 – June 2028', threshold: 95323, full65: 155320, full75: 161320 })
});

const RECOVERY_RATE = 0.15;
const MAX_INCOME = 1_000_000_000;

function recoveryTax(income, threshold, annualOas) {
  return Math.min(annualOas, Math.max(0, (income - threshold) * RECOVERY_RATE));
}

export function calculateOas({
  incomeYear, netWorldIncome, ageBand, monthlyBase, residenceYears, deferralMonths, replacement, marginalRate
}) {
  if (incomeYear !== 2025 && incomeYear !== 2026) throw new RangeError('Choose the 2025 or 2026 income year.');
  if (ageBand !== '65-74' && ageBand !== '75+') throw new RangeError('Choose an OAS age band.');
  if (!Number.isFinite(netWorldIncome) || Math.abs(netWorldIncome) > MAX_INCOME) {
    throw new RangeError('Enter net world income between −$1 billion and $1 billion.');
  }
  if (!Number.isFinite(monthlyBase) || monthlyBase < 0 || monthlyBase > MAX_INCOME) {
    throw new RangeError('Enter a non-negative monthly OAS reference amount up to $1 billion.');
  }
  if (!Number.isInteger(residenceYears) || residenceYears < 0) {
    throw new RangeError('Enter whole, non-negative years of Canadian residence.');
  }
  if (!Number.isInteger(deferralMonths) || deferralMonths < 0) {
    throw new RangeError('Enter whole, non-negative months of deferral.');
  }
  if (!Number.isFinite(replacement) || replacement < 0 || replacement > MAX_INCOME) {
    throw new RangeError('Enter a non-negative withdrawal replacement up to $1 billion.');
  }
  if (!Number.isFinite(marginalRate) || marginalRate < 0 || marginalRate > 100) {
    throw new RangeError('Enter a marginal income tax rate between 0% and 100%.');
  }

  const period = RECOVERY_PERIODS[incomeYear];
  const residenceFraction = Math.min(residenceYears, 40) / 40;
  const monthsDeferred = Math.min(deferralMonths, 60);
  const deferralIncrease = monthsDeferred * 0.006;
  const baseAt65 = monthlyBase * residenceFraction;
  const monthlyWithoutDeferral = baseAt65 * (ageBand === '75+' ? 1.1 : 1);
  const monthlyOas = monthlyWithoutDeferral * (1 + deferralIncrease);
  const annualOas = monthlyOas * 12;
  const recovery = recoveryTax(netWorldIncome, period.threshold, annualOas);

  // Keep gross withdrawals and the pension constant. Only the taxable source changes.
  const tfsaIncome = netWorldIncome - replacement;
  const tfsaRecovery = recoveryTax(tfsaIncome, period.threshold, annualOas);
  const oasSaved = recovery - tfsaRecovery;
  // Line 23500 reduces taxable income. Restoring OAS reduces that deduction.
  const incomeTaxSaved = (replacement - oasSaved) * (marginalRate / 100);
  const combinedSavings = incomeTaxSaved + oasSaved;

  return {
    period,
    residenceFraction,
    deferralIncrease,
    monthlyOas,
    annualOas,
    monthlyDeferralGain: monthlyWithoutDeferral * deferralIncrease,
    grossForgone: baseAt65 * monthsDeferred,
    recovery,
    monthlyRecovery: recovery / 12,
    retainedOas: annualOas - recovery,
    personalElimination: annualOas > 0 ? period.threshold + annualOas / RECOVERY_RATE : null,
    tfsaIncome,
    tfsaRecovery,
    oasSaved,
    incomeTaxSaved,
    combinedSavings,
    effectiveSavingsRate: replacement > 0 ? combinedSavings / replacement : null
  };
}
