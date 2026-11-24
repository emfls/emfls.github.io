export const PARAMETERS = Object.freeze({
  2025: Object.freeze({ lowerRate: 0.005, higherRate: 0.02, residentCredit: 2000 }),
  2026: Object.freeze({ lowerRate: 0.01, higherRate: 0.03, residentCredit: 4000 }),
  2027: Object.freeze({ lowerRate: 0.01, higherRate: 0.04, residentCredit: 4000 }),
});

const OWNERS = ['bc', 'canadian', 'higher'];
const EXEMPTIONS = ['none', 'principal', 'purchase', 'renovation', 'hazard', 'bereavement', 'legacy-strata'];
const TENANTS = ['none', 'arm', 'related', 'mixed'];
const MONEY_LIMIT = 1_000_000_000_000;
const cents = (amount) => Math.round(amount * 100);
const money = (amountInCents) => amountInCents / 100;

function requireRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(label);
  }
}

function estimateYear(parameters, scenario) {
  const { lowerRate, higherRate, residentCredit } = parameters;
  const { taxableShare, share, owner, incomeBalance, wouldBeExemptAsBCResident, residentCreditAvailable } = scenario;
  const rate = owner === 'higher' ? higherRate : lowerRate;
  const gross = cents(taxableShare * rate);
  let creditLimit = 0;
  if (owner === 'bc' && residentCreditAvailable) {
    creditLimit = cents(residentCredit * share);
  } else if (owner !== 'bc') {
    // SVT Act ss. 55–56. The balance multiplier follows the owner's rate.
    const propertyCap = wouldBeExemptAsBCResident ? gross : cents(taxableShare * (rate - lowerRate));
    creditLimit = Math.min(propertyCap, cents(incomeBalance * rate * 10));
  }
  const credit = Math.min(gross, creditLimit);
  return { gross, credit, net: gross - credit };
}

/** Estimates one direct individual owner's interest; monetary outputs are CAD. */
export function calculateSVT({
  assessedValue,
  ownershipPercent,
  owner,
  inTaxableArea = true,
  exemption = 'none',
  tenant = 'none',
  months = 0,
  relatedTenantQualifies = false,
  residentCreditAvailable = true,
  incomeBalance = 0,
  wouldBeExemptAsBCResident = false,
  rentalCosts = 0,
}) {
  requireRange(assessedValue, 0, MONEY_LIMIT, 'Enter a valid taxable assessment value.');
  requireRange(ownershipPercent, Number.MIN_VALUE, 100, 'Enter an ownership share greater than 0% and at most 100%.');
  requireRange(incomeBalance, 0, MONEY_LIMIT, 'Enter a valid B.C. income balance.');
  requireRange(rentalCosts, 0, MONEY_LIMIT, 'Enter valid six-month rental costs.');
  if (!Number.isInteger(months) || months < 0 || months > 12) {
    throw new RangeError('Enter a whole number of qualifying months from 0 to 12.');
  }
  if (!OWNERS.includes(owner) || !EXEMPTIONS.includes(exemption) || !TENANTS.includes(tenant)
    || ![inTaxableArea, relatedTenantQualifies, residentCreditAvailable, wouldBeExemptAsBCResident]
      .every((value) => typeof value === 'boolean')) {
    throw new RangeError('Choose valid owner, property and eligibility options.');
  }

  const share = ownershipPercent / 100;
  const taxableShare = inTaxableArea ? assessedValue * share : 0;
  const related = tenant === 'related' || tenant === 'mixed';
  const eligibleTenancy = months >= 6 && (tenant === 'arm'
    || (related && (owner !== 'higher' || relatedTenantQualifies)));
  const eligibleExemption = exemption === 'principal' ? owner === 'bc'
    : exemption !== 'none' && exemption !== 'legacy-strata';
  const exempt = inTaxableArea && (eligibleExemption || eligibleTenancy);
  const scenario = {
    taxableShare: exempt ? 0 : taxableShare, share, owner, incomeBalance,
    wouldBeExemptAsBCResident, residentCreditAvailable,
  };
  const oldTax = estimateYear(PARAMETERS[2025], scenario);
  const current = estimateYear(PARAMETERS[2026], scenario);
  const next = estimateYear(PARAMETERS[2027], scenario);
  const canCompareRental = inTaxableArea && !exempt;

  return {
    taxableShare: money(cents(taxableShare)),
    exempt,
    eligibleTenancy,
    gross2026: money(current.gross),
    credit2026: money(current.credit),
    net2026: money(current.net),
    net2025: money(oldTax.net),
    extra2026: money(current.net - oldTax.net),
    foreign2027Gross: money(cents(taxableShare * PARAMETERS[2027].higherRate)),
    foreign2027Net: canCompareRental && owner === 'higher' ? money(next.net) : null,
    noDeclaration2026: money(cents(taxableShare * PARAMETERS[2026].higherRate)),
    rentEquivalentMonthly: canCompareRental ? money(Math.round(current.net / 6)) : null,
    breakEvenMonthly: canCompareRental ? money(Math.ceil(Math.max(0, cents(rentalCosts) - current.net) / 6)) : null,
  };
}
