export const MAX_AMOUNT = 1_000_000_000;

function toCents(amount, label, minimum = 0) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < minimum || amount > MAX_AMOUNT || cents / 100 !== amount) {
    throw new RangeError(`${label} must be between A$${minimum} and A$${MAX_AMOUNT.toLocaleString('en-AU')} with at most two decimal places.`);
  }
  return cents;
}

function settlementScenario(grossSalePrice, gst, constructionItc, withholdingAtRate, withholding) {
  const saleOnlyBasBalance = withholding - gst;
  const combinedBasBalance = saleOnlyBasBalance + constructionItc;
  return {
    withholdingAtRate,
    withholding,
    settlementProceeds: grossSalePrice - withholding,
    saleOnlyBasBalance,
    combinedBasBalance,
    netProjectGstCashFlow: constructionItc - gst,
  };
}

export function calculateGst({
  eligibleAcquisitionCostOrValuation,
  lots,
  salePricePerLot,
  constructionCostsInclGst,
  acquisitionStatus,
  writtenAgreement,
}) {
  if (!Number.isInteger(lots) || lots < 1 || lots > 20) {
    throw new RangeError('Enter a whole number of lots from 1 to 20.');
  }
  if (!['eligible_private_or_margin', 'ineligible_full_gst_acquired', 'unconfirmed'].includes(acquisitionStatus)
      || !['yes', 'no'].includes(writtenAgreement)) {
    throw new RangeError('Select an acquisition status and a written agreement status.');
  }

  const basisCents = toCents(eligibleAcquisitionCostOrValuation, 'Acquisition basis');
  const saleCents = toCents(salePricePerLot, 'Sale price per lot', 0.01);
  const constructionCents = toCents(constructionCostsInclGst, 'Creditable development costs');

  const grossSaleCents = saleCents * lots;
  const grossSalePrice = grossSaleCents / 100;
  const standardFullGst = grossSaleCents / 1100;
  const constructionItc = constructionCents / 1100;

  const eligible = acquisitionStatus === 'eligible_private_or_margin' && writtenAgreement === 'yes';
  const marginCents = Math.max(0, grossSaleCents - basisCents);
  const marginSchemeGst = eligible ? marginCents / 1100 : null;

  // The supplier notice floors withholding to whole dollars for each contract.
  const standard = settlementScenario(
    grossSalePrice, standardFullGst, constructionItc, standardFullGst,
    Math.floor(saleCents / 1100) * lots,
  );
  const marginScheme = eligible ? settlementScenario(
    grossSalePrice, marginSchemeGst, constructionItc, grossSaleCents * 7 / 10000,
    Math.floor(saleCents * 7 / 10000) * lots,
  ) : null;

  return {
    eligible,
    grossSalePrice,
    acquisitionBasisPerLot: basisCents / (100 * lots),
    margin: eligible ? marginCents / 100 : null,
    marginSchemeGst,
    standardFullGst,
    directGstSaved: eligible ? standardFullGst - marginSchemeGst : null,
    constructionItc,
    marginScheme,
    standard,
  };
}
