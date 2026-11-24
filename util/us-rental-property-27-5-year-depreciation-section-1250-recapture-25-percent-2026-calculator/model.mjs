const RECOVERY_YEARS = new Map([['residential', 27.5], ['commercial', 39]]);
const NIIT_THRESHOLDS = new Map([
  ['single', 200000], ['hoh', 200000], ['mfj', 250000], ['qss', 250000],
  ['mfs_together', 125000], ['mfs_apart', 125000],
]);

function requireNumber(value, label, min = 0, max = 1e12, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    const type = whole ? 'a whole number' : 'a number';
    throw new RangeError(`${label} must be ${type} between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
  }
}

/**
 * Estimate a 2026 fully taxable, unrelated-party sale of an entire rental
 * activity held over one year. Rates are fractions and all amounts are USD.
 */
export function calculateRentalProperty({
  propertyType, purchasePrice, capitalizableClosingCosts, landValue, capitalImprovements,
  serviceMonth, fullYearsHeld, saleMonth, filingStatus, activeParticipation,
  magi, netRentalTaxLoss, salePrice, sellingCosts, cumulativeSuspendedLosses,
  ordinaryMarginalRate, ltcgRate, saleYearMagiBeforeSale, repsNiitExempt,
}) {
  const recoveryYears = RECOVERY_YEARS.get(propertyType);
  const niitThreshold = NIIT_THRESHOLDS.get(filingStatus);
  if (recoveryYears === undefined) throw new RangeError('Select a supported property type.');
  if (niitThreshold === undefined) throw new RangeError('Select a supported filing status.');
  if (typeof activeParticipation !== 'boolean') throw new TypeError('Active participation must be true or false.');
  if (typeof repsNiitExempt !== 'boolean') throw new TypeError('NIIT exclusion must be true or false.');

  requireNumber(purchasePrice, 'Purchase price', 0.01);
  requireNumber(capitalizableClosingCosts, 'Capitalizable closing costs');
  requireNumber(landValue, 'Land value');
  requireNumber(capitalImprovements, 'Capital improvements');
  requireNumber(serviceMonth, 'Placed-in-service month', 1, 12, true);
  requireNumber(fullYearsHeld, 'Full calendar years', 0, 100, true);
  requireNumber(saleMonth, 'Sale month', 1, 12, true);
  requireNumber(magi, 'Annual passive-loss MAGI', -1e12);
  requireNumber(netRentalTaxLoss, 'Net rental tax loss');
  requireNumber(salePrice, 'Sale price');
  requireNumber(sellingCosts, 'Selling costs');
  requireNumber(cumulativeSuspendedLosses, 'Suspended losses');
  requireNumber(saleYearMagiBeforeSale, 'Sale-year NIIT MAGI', -1e12);
  requireNumber(ordinaryMarginalRate, 'Ordinary marginal rate', 0, 1);
  if (![0, 0.15, 0.20].includes(ltcgRate)) throw new RangeError('Select a long-term capital gains rate of 0%, 15% or 20%.');
  if (landValue > purchasePrice + capitalizableClosingCosts) {
    throw new RangeError('Land value cannot exceed purchase price plus capitalizable closing costs.');
  }

  const originalTotalBasis = purchasePrice + capitalizableClosingCosts + capitalImprovements;
  const buildingBasis = originalTotalBasis - landValue;
  const annualDepreciation = buildingBasis / recoveryYears;
  const year1Months = 12 - serviceMonth + 0.5;
  const saleYearMonths = saleMonth - 0.5;
  const year1Depreciation = annualDepreciation * (year1Months / 12);
  const monthsBeforeSaleYear = year1Months + 12 * fullYearsHeld;
  const depreciableSaleMonths = Math.min(saleYearMonths, Math.max(0, recoveryYears * 12 - monthsBeforeSaleYear));
  const saleYearPartialDep = annualDepreciation * (depreciableSaleMonths / 12);
  const totalDepreciation = Math.min(buildingBasis, annualDepreciation * ((monthsBeforeSaleYear + depreciableSaleMonths) / 12));
  const adjustedBasis = originalTotalBasis - totalDepreciation;
  const netSaleProceeds = salePrice - sellingCosts;
  const gainOrLoss = netSaleProceeds - adjustedBasis;
  const totalRealizedGain = Math.max(0, gainOrLoss);

  const filingApart = filingStatus === 'mfs_apart';
  const allowanceCap = filingApart ? 12500 : 25000;
  const phaseoutStart = filingApart ? 50000 : 100000;
  const allowance = activeParticipation && filingStatus !== 'mfs_together'
    ? Math.max(0, allowanceCap - 0.5 * Math.max(0, magi - phaseoutStart))
    : 0;
  const deductibleAnnualLoss = Math.min(netRentalTaxLoss, allowance);
  const annualSuspendedLoss = netRentalTaxLoss - deductibleAnnualLoss;

  const unrecapturedSec1250Gain = Math.min(totalRealizedGain, totalDepreciation);
  const pureCapitalGain = totalRealizedGain - unrecapturedSec1250Gain;
  const section1250Rate = Math.min(ordinaryMarginalRate, 0.25);
  const section1250Tax = unrecapturedSec1250Gain * section1250Rate;
  const ltcgTax = pureCapitalGain * ltcgRate;
  const grossRegularTax = section1250Tax + ltcgTax;

  // Released losses are deductions. Preserve the character of each gain bucket.
  const releasedLosses = cumulativeSuspendedLosses;
  const estimatedLossBenefit = releasedLosses * ordinaryMarginalRate;
  const saleYearMagi = saleYearMagiBeforeSale + totalRealizedGain - releasedLosses;
  const propertyNetInvestmentIncome = repsNiitExempt ? 0 : Math.max(0, totalRealizedGain - releasedLosses);
  const niit = 0.038 * Math.min(propertyNetInvestmentIncome, Math.max(0, saleYearMagi - niitThreshold));
  const exitTax = grossRegularTax + niit - estimatedLossBenefit;

  return {
    recoveryYears, originalTotalBasis, buildingBasis, annualDepreciation,
    year1Months, saleYearMonths, year1Depreciation, saleYearPartialDep, totalDepreciation,
    allowance, deductibleAnnualLoss, annualSuspendedLoss, adjustedBasis, netSaleProceeds,
    gainOrLoss, totalRealizedGain, unrecapturedSec1250Gain, pureCapitalGain, section1250Rate,
    section1250Tax, ltcgTax, grossRegularTax, releasedLosses, estimatedLossBenefit,
    saleYearMagi, niitThreshold, propertyNetInvestmentIncome, niit, exitTax,
    exchangeTaxDeferred: grossRegularTax,
  };
}
