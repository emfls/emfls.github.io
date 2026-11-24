export const POLICY = Object.freeze({
  cityRate: 0.03,
  canadianRate: 0.01,
  foreignRate: 0.03,
  bcResidentCredit: 4000,
  bcMinimumTaxableValue: 150_000,
  cityNotice: 250,
  thresholdMonths: 6,
});

function validateNumber(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter ${label} between ${min.toLocaleString('en-CA')} and ${max.toLocaleString('en-CA')}.`);
  }
}

const cents = amount => Math.round((amount + Number.EPSILON) * 100) / 100;

export function calculate({
  assessedValue, ownerStatus, monthsRented, monthlyRent, marginalRate,
  afterTaxRentalCosts, cityTenancy, bcTenancy, cityDeclared, bcCredit,
}) {
  validateNumber(assessedValue, 1, 100_000_000, 'an assessed value');
  validateNumber(monthsRented, 0, 12, 'rented months');
  validateNumber(monthlyRent, 0, 100_000, 'monthly rent');
  validateNumber(marginalRate, 0, 100, 'a marginal income tax rate');
  validateNumber(afterTaxRentalCosts, 0, 1_000_000, 'after-tax rental costs');
  if (ownerStatus !== 'canadian_pr' && ownerStatus !== 'foreign_satellite') {
    throw new RangeError('Choose a listed owner category.');
  }
  if ([cityTenancy, bcTenancy, cityDeclared, bcCredit].some(value => typeof value !== 'boolean')) {
    throw new RangeError('Choose the tenancy, filing and credit options.');
  }

  const canadian = ownerStatus === 'canadian_pr';
  const svtRate = canadian ? POLICY.canadianRate : POLICY.foreignRate;
  const enoughMonths = monthsRented >= POLICY.thresholdMonths;
  const cityQualifies = enoughMonths && cityTenancy;
  const bcQualifies = enoughMonths && bcTenancy;
  let tenancyStatus = 'below-six';
  if (enoughMonths) {
    if (cityQualifies) tenancyStatus = bcQualifies ? 'both' : 'city-only';
    else tenancyStatus = bcQualifies ? 'bc-only' : 'neither';
  }

  const vacantEht = cents(assessedValue * POLICY.cityRate);
  const vacantSvtBeforeCredit = assessedValue > POLICY.bcMinimumTaxableValue
    ? cents(assessedValue * svtRate)
    : 0;
  const vacantCredit = canadian && bcCredit ? Math.min(vacantSvtBeforeCredit, POLICY.bcResidentCredit) : 0;
  const vacantSvt = cents(vacantSvtBeforeCredit - vacantCredit);
  const vacantTax = cents(vacantEht + vacantSvt);
  const eht = cityQualifies && cityDeclared ? 0 : vacantEht;
  const svt = bcQualifies ? 0 : vacantSvt;
  const annualTax = cents(eht + svt);
  const taxAvoided = cents(vacantTax - annualTax);

  const retainedShare = (100 - marginalRate) / 100;
  const grossRent = cents(monthlyRent * monthsRented);
  const rentalCosts = monthsRented > 0 ? cents(afterTaxRentalCosts) : 0;
  const netRentalIncome = cents(cents(grossRent * retainedShare) - rentalCosts);
  const cashSwing = cents(taxAvoided + netRentalIncome);
  const remainingCosts = Math.max(0, cents(rentalCosts - taxAvoided));
  const monthlyRetainedShare = monthsRented * retainedShare;
  let breakEvenRent = null;
  if (monthsRented > 0 && remainingCosts === 0) breakEvenRent = 0;
  else if (monthlyRetainedShare > 0) {
    const requiredRent = Math.ceil(remainingCosts * 100 / monthlyRetainedShare) / 100;
    if (Number.isFinite(requiredRent)) breakEvenRent = requiredRent;
  }

  return {
    eht, svt, svtRate, annualTax, effectiveRate: annualTax / assessedValue * 100,
    fiveYearCost: cents(annualTax * 5),
    vacantTax, vacantFiveYearCost: cents(vacantTax * 5),
    creditApplied: bcQualifies ? 0 : vacantCredit,
    cityNotice: cityDeclared ? 0 : POLICY.cityNotice,
    tenancyStatus, grossRent, netRentalIncome, taxAvoided, cashSwing, breakEvenRent,
  };
}
