export const PARAMETERS = Object.freeze({
  threshold: 250_000,
  division293Rate: 0.15,
  concessionalCap: 32_500,
  carryForwardBalanceLimit: 500_000,
  sgRate: 0.12,
  maximumContributionBase: 270_830,
  earningsTaxRate: 0.15,
  projectionYears: 15,
});

function cents(value, label, allowNegative = false) {
  if (!Number.isFinite(value) || Math.abs(value) > 2e9 || (!allowNegative && value < 0)) {
    throw new RangeError(`${label} is outside the supported range.`);
  }
  return Math.round(value * 100);
}

function percentOfCents(value, rate) {
  return Math.round(value * Math.round(rate * 100) / 100);
}

export function estimateSuperGuarantee(qualifyingEarnings) {
  const earnings = cents(qualifyingEarnings, 'Qualifying earnings');
  const cappedEarnings = Math.min(earnings, PARAMETERS.maximumContributionBase * 100);
  return percentOfCents(cappedEarnings, PARAMETERS.sgRate) / 100;
}

export function calculateDivision293({
  taxableIncome,
  reportableFringeBenefits = 0,
  totalNetInvestmentLosses = 0,
  familyTrustDistributions = 0,
  zeroTaxSuperLumpSum = 0,
  firstHomeSuperSaverRelease = 0,
  totalConcessionalContributions,
  priorSuperBalance = null,
  unusedCarryForward = 0,
}) {
  // Form inputs are dollar amounts to the cent. Use integer cents at the threshold.
  const income = cents(taxableIncome, 'Taxable income', true)
    + cents(reportableFringeBenefits, 'Reportable fringe benefits')
    + cents(totalNetInvestmentLosses, 'Net investment losses')
    + cents(familyTrustDistributions, 'Family trust distributions')
    - cents(zeroTaxSuperLumpSum, 'Zero-tax super lump sum')
    - cents(firstHomeSuperSaverRelease, 'First home super saver release');
  const contributions = cents(totalConcessionalContributions, 'Concessional contributions');
  const unusedCap = cents(unusedCarryForward, 'Unused carry-forward cap');
  const carryForwardEligible = priorSuperBalance !== null
    && cents(priorSuperBalance, 'Prior total super balance') < PARAMETERS.carryForwardBalanceLimit * 100;
  const baseCap = PARAMETERS.concessionalCap * 100;
  const cap = baseCap + (carryForwardEligible ? unusedCap : 0);
  const lowTax = Math.min(contributions, cap);
  const combined = income + lowTax;
  const excess = Math.max(0, combined - PARAMETERS.threshold * 100);
  const taxable = Math.min(lowTax, excess);

  return {
    div293Income: income / 100,
    applicableConcessionalCap: cap / 100,
    carryForwardEligible,
    carryForwardUsed: Math.max(0, lowTax - baseCap) / 100,
    remainingCap: (cap - lowTax) / 100,
    excessConcessionalContributions: (contributions - lowTax) / 100,
    lowTaxSuperContributions: lowTax / 100,
    combinedTotal: combined / 100,
    excessOver250k: excess / 100,
    taxableDiv293Amount: taxable / 100,
    div293TaxPayable: percentOfCents(taxable, PARAMETERS.division293Rate) / 100,
  };
}

export function comparePayment({ taxBill, grossSuperReturn, netCashReturn }) {
  const bill = cents(taxBill, 'Division 293 bill') / 100;
  for (const rate of [grossSuperReturn, netCashReturn]) {
    if (!Number.isFinite(rate) || rate < -1 || rate > 1) {
      throw new RangeError('Annual returns must be between −100% and 100%.');
    }
  }
  const years = PARAMETERS.projectionYears;
  const netSuperReturn = grossSuperReturn - Math.max(0, grossSuperReturn) * PARAMETERS.earningsTaxRate;
  const extraSuperIfPayCash = bill * (1 + netSuperReturn) ** years;
  const cashRetainedIfRelease = bill * (1 + netCashReturn) ** years;

  return {
    years,
    netSuperReturn,
    extraSuperIfPayCash,
    cashRetainedIfRelease,
    superGrowthForgone: extraSuperIfPayCash - bill,
    netDifferenceIfPayCash: extraSuperIfPayCash - cashRetainedIfRelease,
  };
}
