export const MAX_EXCLUDED_DAYS = 14;
export const RENT_REPORTING_THRESHOLD = 2000;
export const FEDERAL_CORPORATE_RATE = 0.21;
export const QBI_DEDUCTION_RATE = 0.20;
export const NIIT_RATE = 0.038;

const passThroughEntities = ['s-corp', 'partnership'];
const blockedEntities = ['sole-proprietor', 'disregarded-llc'];
const dollars = cents => cents / 100;
const tax = (cents, rate) => Math.round(cents * rate);

export function calculateAugustaRule({
  entity, rentalDays, otherRentalDays = 0, usedAsResidence,
  dailyFmvRate, localHotelBenchmarkRate,
  federalMarginalRate, stateMarginalRate, stateCorpRate = 0,
  qbiEligible = false, dividendRate = 0.15, dividendNiitApplies = false,
  paperwork = [],
}) {
  const isCorporation = entity === 'c-corp';
  const eligible = isCorporation || passThroughEntities.includes(entity);
  if (!eligible && !blockedEntities.includes(entity)) throw new RangeError('Select a federal entity classification.');
  if (![rentalDays, otherRentalDays].every(days => Number.isInteger(days) && days >= 0)
    || rentalDays + otherRentalDays > 365) {
    throw new RangeError('Enter whole rental days totaling 0 to 365.');
  }
  if (typeof usedAsResidence !== 'boolean') throw new RangeError('Confirm whether the home was used as a residence.');
  if (![dailyFmvRate, localHotelBenchmarkRate].every(rate => Number.isFinite(rate) && rate > 0 && rate <= 1000000)) {
    throw new RangeError('Enter both daily amounts between $0.01 and $1,000,000.');
  }
  if (![federalMarginalRate, stateMarginalRate, stateCorpRate].every(rate => Number.isFinite(rate) && rate >= 0 && rate <= 1)
    || federalMarginalRate + stateMarginalRate > 1 || stateCorpRate > 1 - FEDERAL_CORPORATE_RATE
    || ![0, 0.15, 0.20].includes(dividendRate)) {
    throw new RangeError('Enter valid tax rates. Combined personal and corporate rates must each be at most 100%.');
  }
  const dailyCents = Math.round(dailyFmvRate * 100);
  const benchmarkCents = Math.round(localHotelBenchmarkRate * 100);
  if (dailyCents === 0 || benchmarkCents === 0) throw new RangeError('Daily amounts must round to at least $0.01.');

  const totalRentalDays = rentalDays + otherRentalDays;
  const cliffTriggered = eligible && usedAsResidence && totalRentalDays > MAX_EXCLUDED_DAYS;
  const exclusionApplies = eligible && usedAsResidence && !cliffTriggered && totalRentalDays > 0;
  const rentCents = eligible ? rentalDays * dailyCents : 0;
  const personalRate = federalMarginalRate + stateMarginalRate;
  const qbiApplies = eligible && !isCorporation && qbiEligible;
  const effectiveFederalRate = isCorporation ? FEDERAL_CORPORATE_RATE
    : federalMarginalRate * (qbiApplies ? 1 - QBI_DEDUCTION_RATE : 1);
  const businessRate = eligible ? effectiveFederalRate + (isCorporation ? stateCorpRate : stateMarginalRate) : 0;
  const businessTaxCents = tax(rentCents, businessRate);
  const taxableRentCents = exclusionApplies ? 0 : rentCents;
  const personalTaxCents = tax(taxableRentCents, personalRate);
  const netTaxCents = businessTaxCents - personalTaxCents;

  // Isolate the modeled change from day 14 to day 15, holding other rental days and rates fixed.
  const businessDaysAtCliff = MAX_EXCLUDED_DAYS + 1 - otherRentalDays;
  const cliffApplicable = eligible && usedAsResidence && businessDaysAtCliff >= 1;
  const cliffRentCents = cliffApplicable ? businessDaysAtCliff * dailyCents : 0;
  const cliffPersonalTaxCents = tax(cliffRentCents, personalRate);
  const day14Savings = tax(cliffRentCents ? cliffRentCents - dailyCents : 0, businessRate);
  const day15Savings = tax(cliffRentCents, businessRate) - cliffPersonalTaxCents;

  // Compare equal pretax corporate dollars. The alternative dividend uses after-corporate-tax cash.
  const dividendTaxCents = isCorporation
    ? tax(Math.max(0, rentCents - businessTaxCents), dividendRate + (dividendNiitApplies ? NIIT_RATE : 0))
    : 0;

  const fmvRisk = dailyCents * 100 <= benchmarkCents * 115 ? 'LOW_AUDIT_RISK'
    : dailyCents * 100 <= benchmarkCents * 150 ? 'MODERATE' : 'HIGH_SINOPOLI_AUDIT_RISK';

  return {
    eligible, exclusionApplies, cliffTriggered, cliffApplicable, totalRentalDays,
    qbiApplies, effectiveFederalRate: eligible ? effectiveFederalRate : 0, businessRate,
    totalRentPaid: dollars(rentCents),
    taxFreeCashExtracted: exclusionApplies ? dollars(rentCents) : 0,
    taxableRentalIncome: dollars(taxableRentCents),
    personalTaxOnRent: dollars(personalTaxCents),
    businessTaxSavings: dollars(businessTaxCents),
    netTaxSavings: dollars(netTaxCents),
    fiveYearTaxSavings: dollars(netTaxCents * 5),
    cliffPersonalTax: dollars(cliffPersonalTaxCents),
    cliffLoss: dollars(day14Savings - day15Savings),
    avoidedDividendTax: dollars(dividendTaxCents),
    taxSavingsVsDividend: isCorporation ? dollars(netTaxCents + dividendTaxCents) : 0,
    form1099MiscTriggered: rentCents >= RENT_REPORTING_THRESHOLD * 100,
    fmvRatio: dailyCents / benchmarkCents,
    fmvRisk,
    paperworkScore: paperwork.slice(0, 6).filter(checked => checked === true).length,
  };
}
