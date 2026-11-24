const FEDERAL_RATE = 0.05;
const MORTGAGE_MONTHS = 300;
const PROVINCIAL_RATES = Object.freeze({
  AB: 0, BC: 0, MB: 0, NB: 0.10, NL: 0.10, NS: 0.09, NT: 0,
  NU: 0, ON: 0.08, PE: 0.10, QC: 0.09975, SK: 0, YT: 0,
});

const cents = (amount) => Math.round((amount + 1e-9) * 100) / 100;
const phaseOut = (price, start, end) => Math.max(0, Math.min(1, (end - price) / (end - start)));

function requireRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid ${label} between ${min} and ${max}.`);
  }
}

function isEligibleAgreement(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError('Enter a valid original agreement date.');
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new RangeError('Enter a valid original agreement date.');
  }
  return date >= '2025-03-20' && date < '2031-01-01';
}

export function mortgagePayment(principal, annualRate) {
  if (annualRate === 0) return principal / MORTGAGE_MONTHS;
  // Convert a nominal Canadian fixed rate compounded semi-annually to a monthly rate.
  const monthlyLogFactor = Math.log1p(annualRate / 200) / 6;
  return principal * Math.expm1(monthlyLogFactor) / -Math.expm1(-MORTGAGE_MONTHS * monthlyLogFactor);
}

export function calculateRebate({
  homePrice, province, propertyType, qualifyingUse, firstTimeEligible, provincialEligible,
  agreementDate, downPaymentPercent, annualRate, nsCombinationConfirmed = false,
}) {
  requireRange(homePrice, 0.01, 100_000_000, 'pre-tax home price');
  requireRange(downPaymentPercent, 0, 100, 'down payment percentage');
  requireRange(annualRate, 0, 30, 'annual mortgage rate');
  if (!Object.hasOwn(PROVINCIAL_RATES, province)) throw new RangeError('Choose a valid province or territory.');
  if (!['new', 'renovated', 'resale'].includes(propertyType)) throw new RangeError('Choose a valid property type.');

  const taxable = propertyType !== 'resale';
  const agreementEligible = taxable && isEligibleAgreement(agreementDate);
  const standardEligible = taxable && qualifyingUse === true;
  const fthbEligible = standardEligible && firstTimeEligible === true && agreementEligible;
  const federalGstPaid = taxable ? cents(homePrice * FEDERAL_RATE) : 0;
  const provincialTax = taxable ? cents(homePrice * PROVINCIAL_RATES[province]) : 0;
  const grossTax = cents(federalGstPaid + provincialTax);

  const standardFederalRebate = standardEligible
    ? cents(homePrice <= 350_000 ? federalGstPaid * 0.36 : 6_300 * phaseOut(homePrice, 350_000, 450_000))
    : 0;
  const federalRebate = fthbEligible
    ? cents(homePrice <= 1_000_000 ? federalGstPaid : 50_000 * phaseOut(homePrice, 1_000_000, 1_500_000))
    : standardFederalRebate;
  const billC4Rebate = cents(federalRebate - standardFederalRebate);

  let provincialRebate = 0;
  let nsPotentialRebate = 0;
  if (standardEligible && provincialEligible === true) {
    if (province === 'ON') provincialRebate = Math.min(24_000, provincialTax * 0.75);
    if (province === 'QC') {
      provincialRebate = homePrice <= 200_000 ? provincialTax * 0.5 : 9_975 * phaseOut(homePrice, 200_000, 300_000);
    }
    if (province === 'NS' && propertyType === 'new') {
      nsPotentialRebate = cents(Math.min(3_000, provincialTax * 0.1875));
      if (billC4Rebate === 0 || nsCombinationConfirmed === true) provincialRebate = nsPotentialRebate;
    }
  }

  provincialRebate = cents(provincialRebate);
  const combinedRebate = cents(federalRebate + provincialRebate);
  const netTax = cents(grossTax - combinedRebate);
  const netPurchasePrice = cents(homePrice + netTax);
  const downPayment = cents(homePrice * downPaymentPercent / 100);
  const principalAfter = cents(netPurchasePrice - downPayment);
  const principalBefore = cents(homePrice + grossTax - downPayment);
  const monthlyAfter = cents(mortgagePayment(principalAfter, annualRate));
  const monthlyBefore = cents(mortgagePayment(principalBefore, annualRate));
  const interestSaved = cents(mortgagePayment(combinedRebate, annualRate) * MORTGAGE_MONTHS - combinedRebate);

  return {
    agreementEligible, fthbEligible, federalGstPaid, provincialTax, grossTax, standardFederalRebate,
    federalRebate, billC4Rebate, provincialRebate, nsPotentialRebate, combinedRebate, netTax,
    netPurchasePrice, principalBefore, principalAfter, monthlyBefore, monthlyAfter, interestSaved,
  };
}
