export const INCLUSION_RATE = 0.5;
export const MAX_ELECTION_YEARS = 4;
export const TOP_MARGINAL_RATES = Object.freeze({
  ON: 53.53,
  BC: 53.5,
  AB: 48,
  QC: 53.31,
});

function checkNumber(name, value, min, max, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    const unit = whole ? 'a whole number' : 'a number';
    throw new RangeError(`${name} must be ${unit} from ${min} to ${max}.`);
  }
}

function checkFlag(name, value) {
  if (typeof value !== 'boolean') throw new TypeError(`${name} requires a yes or no answer.`);
}

export function marginalRate(preset, customRate) {
  if (Object.hasOwn(TOP_MARGINAL_RATES, preset)) return TOP_MARGINAL_RATES[preset];
  if (preset !== 'custom') throw new RangeError('Choose a province or enter a custom rate.');
  checkNumber('Marginal tax rate', customRate, 0, 100);
  return customRate;
}

export function principalResidenceExemption(grossCapitalGain, yearsDesignatedAsPR, totalTaxYearsOwned, residentAtAcquisition) {
  if (!Number.isFinite(grossCapitalGain)) throw new RangeError('Gross capital gain must be finite.');
  checkNumber('Tax years owned', totalTaxYearsOwned, 1, 150, true);
  checkNumber('Principal residence designations', yearsDesignatedAsPR, 0, totalTaxYearsOwned, true);
  checkFlag('Acquisition-year residency', residentAtAcquisition);

  // The plus-one rule applies to a property designated as a principal residence.
  const plusOne = Number(residentAtAcquisition && yearsDesignatedAsPR > 0);
  const exemptFraction = Math.min(1, (yearsDesignatedAsPR + plusOne) / totalTaxYearsOwned);
  const positiveGain = Math.max(0, grossCapitalGain);
  const exemptGain = positiveGain * exemptFraction;
  return { plusOne, exemptFraction, exemptGain, remainingCapitalGain: positiveGain - exemptGain };
}

function capitalGainsTax(remainingCapitalGain, marginalTaxRate) {
  const taxableCapitalGain = remainingCapitalGain * INCLUSION_RATE;
  const taxCents = Math.round(taxableCapitalGain * marginalTaxRate);
  return { taxableCapitalGain, tax: taxCents / 100, taxCents };
}

// The no-election scenario assumes the PRE fully shelters positive pre-conversion
// appreciation. The comparison excludes capital loss relief and CCA recapture.
export function compareStrategies({
  adjustedCostBase, fmvAtConversion, salePrice, sellingCosts, totalTaxYearsOwned,
  occupiedDesignations, eligibleRentalYears, residentAtAcquisition, claimedCCA,
  marginalTaxRate,
}) {
  const maxDollars = 1_000_000_000;
  checkNumber('Adjusted cost base', adjustedCostBase, 0, maxDollars);
  checkNumber('Fair market value at conversion', fmvAtConversion, 0.01, maxDollars);
  checkNumber('Sale price', salePrice, 0.01, maxDollars);
  checkNumber('Selling costs', sellingCosts, 0, salePrice);
  checkNumber('Tax years owned', totalTaxYearsOwned, 1, 150, true);
  checkNumber('Occupied designation years', occupiedDesignations, 0, totalTaxYearsOwned, true);
  checkNumber('Eligible rental-only years', eligibleRentalYears, 0, totalTaxYearsOwned - occupiedDesignations, true);
  checkNumber('Marginal tax rate', marginalTaxRate, 0, 100);
  checkFlag('Acquisition-year residency', residentAtAcquisition);
  checkFlag('CCA claim', claimedCCA);

  const netSaleProceeds = salePrice - sellingCosts;
  const preConversionGain = fmvAtConversion - adjustedCostBase;
  const rentalGain = netSaleProceeds - fmvAtConversion;
  const rentalCapitalGain = Math.max(0, rentalGain);
  const noElection = {
    preConversionGain,
    grossCapitalGain: rentalGain,
    exemptGain: Math.max(0, preConversionGain),
    remainingCapitalGain: rentalCapitalGain,
    ...capitalGainsTax(rentalCapitalGain, marginalTaxRate),
  };

  if (claimedCCA) return { election: null, noElection, preferred: 'unavailable', savings: null };

  const grossCapitalGain = netSaleProceeds - adjustedCostBase;
  const rentalDesignations = Math.min(MAX_ELECTION_YEARS, eligibleRentalYears);
  const yearsDesignatedAsPR = occupiedDesignations + rentalDesignations;
  const exemption = principalResidenceExemption(
    grossCapitalGain, yearsDesignatedAsPR, totalTaxYearsOwned, residentAtAcquisition,
  );
  const election = {
    grossCapitalGain, rentalDesignations, yearsDesignatedAsPR, ...exemption,
    ...capitalGainsTax(exemption.remainingCapitalGain, marginalTaxRate),
  };
  const difference = noElection.taxCents - election.taxCents;
  let preferred = 'tie';
  if (difference > 0) preferred = 'election';
  else if (difference < 0) preferred = 'noElection';
  return { election, noElection, preferred, savings: Math.abs(difference) / 100 };
}
