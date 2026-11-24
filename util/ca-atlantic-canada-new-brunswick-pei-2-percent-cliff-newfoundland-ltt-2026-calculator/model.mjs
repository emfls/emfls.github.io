export const MAX_AMOUNT = 100_000_000;
export const PEI_CLIFF = 1_000_000;
export const PEI_TARGET = 999_500;
export const NL_MORTGAGE_CAP = 5_000;

function toCents(amount, label, minimum = 0) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < minimum || amount > MAX_AMOUNT || cents / 100 !== amount) {
    throw new RangeError(`${label} must be between ${minimum} and ${MAX_AMOUNT}, with up to two decimal places.`);
  }
  return cents;
}

function peiTax(taxBase, firstTime, proposal) {
  if (taxBase <= 3_000_000) return 0;
  if (proposal && taxBase >= PEI_CLIFF * 100) return Math.round(taxBase * 2 / 100);
  return firstTime ? 0 : Math.round(taxBase / 100);
}

function nlRegistrationFee(value) {
  return 10_000 + 40 * Math.ceil(Math.max(0, value - 50_000) / 10_000);
}

export function calculateAtlantic({
  purchasePrice, assessedValue, mortgageAmount, firstTime = false, proposal = false,
  nbDeedFee = 85, nbMortgageFee = 85,
}) {
  // Use integer cents for threshold comparisons, fee increments, and totals.
  const price = toCents(purchasePrice, 'Purchase price', 0.01);
  const assessment = toCents(assessedValue, 'Assessed value');
  const mortgage = toCents(mortgageAmount, 'Mortgage amount');
  const nbDeed = toCents(nbDeedFee, 'NB deed fee');
  const nbMortgage = toCents(nbMortgageFee, 'NB mortgage fee');
  const base = Math.max(price, assessment);
  const nbTax = Math.round(base / 100);
  const nbMortgageCharged = mortgage > 0 ? nbMortgage : 0;
  const peiCharged = peiTax(base, firstTime, proposal);
  const nlDeed = nlRegistrationFee(price);
  const nlUncapped = mortgage > 0 ? nlRegistrationFee(mortgage) : 0;
  const nlMortgage = Math.min(nlUncapped, NL_MORTGAGE_CAP * 100);
  const halifaxTax = Math.round(price * 15 / 1000);

  const ranking = [
    ['NB', 'New Brunswick', nbTax, nbDeed + nbMortgageCharged],
    ['PEI', 'Prince Edward Island', peiCharged, 0],
    ['NL', 'Newfoundland and Labrador', 0, nlDeed + nlMortgage],
    ['NS', 'Nova Scotia (Halifax)', halifaxTax, 0],
  ].map(([code, name, tax, fees]) => ({
    code, name, tax: tax / 100, fees: fees / 100,
    total: (tax + fees) / 100, fractionOfPrice: (tax + fees) / price,
  })).sort((a, b) => a.total - b.total);

  return {
    taxBase: base / 100,
    nb: { tax: nbTax / 100, deedFee: nbDeed / 100, mortgageFee: nbMortgageCharged / 100 },
    pei: {
      tax: peiCharged / 100,
      firstTimeSavings: (peiTax(base, false, proposal) - peiCharged) / 100,
      cliffTriggered: proposal && base >= PEI_CLIFF * 100,
      targetTax: peiTax(Math.max(PEI_TARGET * 100, assessment), firstTime, true) / 100,
    },
    nl: {
      deedFee: nlDeed / 100, mortgageFee: nlMortgage / 100,
      uncappedMortgageFee: nlUncapped / 100, capSavings: (nlUncapped - nlMortgage) / 100,
    },
    halifaxTax: halifaxTax / 100,
    ranking,
  };
}
