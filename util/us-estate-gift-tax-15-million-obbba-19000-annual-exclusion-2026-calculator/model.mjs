export const EXEMPTION = 15_000_000;
export const ANNUAL_EXCLUSION = 19_000;
export const SUNSET_EXEMPTION = 7_000_000;
export const ESTATE_TAX_RATE = 0.40;

const MAX_DOLLARS = 1_000_000_000_000;

function toCents(value, label) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > MAX_DOLLARS || cents / 100 !== value) {
    throw new RangeError(`${label} must be between $0 and $1 trillion with at most two decimal places.`);
  }
  return cents;
}

export function calculateEstateGiftTax({
  mode, grossEstate, deductions, priorLifetimeGifts, giftPerRecipient, recipients, directPayments
}) {
  if (mode !== 'individual' && mode !== 'married_portability') {
    throw new RangeError('Select a household scenario.');
  }
  if (!Number.isSafeInteger(recipients) || recipients < 0) {
    throw new RangeError('Enter a whole number of recipients of zero or more.');
  }

  const gross = toCents(grossEstate, 'Gross estate');
  const allowableDeductions = toCents(deductions, 'Deductions');
  const prior = toCents(priorLifetimeGifts, 'Prior taxable gifts');
  const gift = toCents(giftPerRecipient, 'Gift per recipient');
  const excluded = toCents(directPayments, 'Direct payments');
  if (gift > 0 && recipients === 0) {
    throw new RangeError('Enter at least one recipient or set the gift amount to $0.');
  }
  if (gift * recipients > MAX_DOLLARS * 100) {
    throw new RangeError('Total gifts to recipients must be $1 trillion or less.');
  }

  const multiplier = mode === 'married_portability' ? 2 : 1;
  const baseExemption = EXEMPTION * multiplier;
  const sunsetExemption = SUNSET_EXEMPTION * multiplier;
  const annualExclusionPerRecipient = ANNUAL_EXCLUSION * multiplier;
  const taxablePerRecipient = Math.max(0, gift - annualExclusionPerRecipient * 100);
  const totalTaxable = taxablePerRecipient * recipients;
  const exemptionUsed = prior + totalTaxable;
  const netEstate = Math.max(0, gross - allowableDeductions);
  const remaining = Math.max(0, baseExemption * 100 - exemptionUsed);
  const sunsetRemaining = Math.max(0, sunsetExemption * 100 - exemptionUsed);
  const taxableEstate = Math.max(0, netEstate - remaining);
  const federalTax = Math.round(taxableEstate * ESTATE_TAX_RATE);
  const sunsetTax = Math.round(Math.max(0, netEstate - sunsetRemaining) * ESTATE_TAX_RATE);

  return {
    baseExemption,
    sunsetExemption,
    annualExclusionPerRecipient,
    taxable2026GiftPerRecipient: taxablePerRecipient / 100,
    totalTaxable2026Gifts: totalTaxable / 100,
    form709Required: gift > ANNUAL_EXCLUSION * 100,
    directPaymentsExcluded: excluded / 100,
    remainingLifetimeExemption: remaining / 100,
    currentGiftsAboveAvailableExemption: Math.max(0, totalTaxable - Math.max(0, baseExemption * 100 - prior)) / 100,
    netEstate: netEstate / 100,
    taxableEstate: taxableEstate / 100,
    federalEstateTax: federalTax / 100,
    sunsetEstateTax: sunsetTax / 100,
    estateTaxSaved: (sunsetTax - federalTax) / 100
  };
}
