export const THRESHOLDS = Object.freeze({
  single: 256000,
  hoh: 256000,
  mfs: 256000,
  trust: 256000,
  mfj: 512000,
});
export const NOL_RATE = 0.8;
export const MAX_AMOUNT = 1_000_000_000;

function validateAmount(amount, label, min = 0, max = MAX_AMOUNT) {
  if (!Number.isFinite(amount) || amount < min || amount > max) {
    throw new RangeError(`${label} must be a number between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
  }
}

export function calculate({
  filingStatus, businessIncome, businessDeductions, bonusDepreciation,
  nonBusinessTaxableIncome, marginalRate, futureTaxableIncome,
}) {
  if (!Object.hasOwn(THRESHOLDS, filingStatus)) {
    throw new RangeError('Select a filing status.');
  }
  validateAmount(businessIncome, 'Business gross income and gains');
  validateAmount(businessDeductions, 'Business deductions');
  validateAmount(bonusDepreciation, 'Additional depreciation');
  validateAmount(nonBusinessTaxableIncome, '2026 nonbusiness taxable income', -MAX_AMOUNT);
  validateAmount(marginalRate, 'Marginal federal tax rate', 0, 100);
  if (!Array.isArray(futureTaxableIncome) || futureTaxableIncome.length !== 3) {
    throw new RangeError('Enter three annual taxable income projections.');
  }

  const threshold = THRESHOLDS[filingStatus];
  const lossBeforeBonus = Math.max(0, businessDeductions - businessIncome);
  const netBusinessIncome = businessIncome - (businessDeductions + bonusDepreciation);
  const netBusinessLoss = Math.max(0, -netBusinessIncome);
  const taxableIncomeBeforeLoss = Math.max(0, nonBusinessTaxableIncome + Math.max(0, netBusinessIncome));
  const allowableCurrentYearLossOffset = Math.min(netBusinessLoss, threshold);
  const currentYearLossUsed = Math.min(allowableCurrentYearLossOffset, taxableIncomeBeforeLoss);
  const disallowedExcessBusinessLoss = netBusinessLoss - allowableCurrentYearLossOffset;
  const bonusDrivenDeferral = disallowedExcessBusinessLoss - Math.max(0, lossBeforeBonus - threshold);

  const taxableIncomeWithLimit = taxableIncomeBeforeLoss - currentYearLossUsed;
  const taxableIncomeWithoutLimit = Math.max(0, taxableIncomeBeforeLoss - netBusinessLoss);
  const cashTaxShock = (taxableIncomeWithLimit - taxableIncomeWithoutLimit) * marginalRate / 100;
  const blockedOffsetBeforeBonus = Math.min(lossBeforeBonus, taxableIncomeBeforeLoss)
    - Math.min(lossBeforeBonus, threshold, taxableIncomeBeforeLoss);
  const bonusDrivenCashTaxShock = Math.max(
    0, taxableIncomeWithLimit - taxableIncomeWithoutLimit - blockedOffsetBeforeBonus,
  ) * marginalRate / 100;

  let remainingNol = disallowedExcessBusinessLoss;
  const years = Array.from(futureTaxableIncome, (income, index) => {
    const year = 2027 + index;
    validateAmount(income, `${year} taxable income`, -MAX_AMOUNT);
    const taxableIncomeBeforeNol = Math.max(0, income);
    const openingNol = remainingNol;
    const nolCap = taxableIncomeBeforeNol * NOL_RATE;
    const nolUsed = Math.min(openingNol, nolCap);
    remainingNol = openingNol - nolUsed;
    return {
      year, openingNol, taxableIncomeBeforeNol, nolCap, nolUsed, remainingNol,
      taxableIncomeAfterNol: taxableIncomeBeforeNol - nolUsed,
    };
  });

  return {
    threshold, netBusinessLoss, allowableCurrentYearLossOffset, currentYearLossUsed,
    disallowedExcessBusinessLoss, bonusDrivenDeferral, taxableIncomeWithLimit,
    taxableIncomeWithoutLimit, cashTaxShock, bonusDrivenCashTaxShock, years,
  };
}
