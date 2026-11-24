const BASE_BRACKETS = [
  [55_000, 50],
  [250_000, 100],
  [400_000, 150],
  [2_000_000, 200],
];
const ONTARIO_BRACKETS = [...BASE_BRACKETS, [Infinity, 250]];
const TORONTO_BASE = [...BASE_BRACKETS, [3_000_000, 250]];
const TORONTO_BRACKETS = {
  'jan-mar': [...TORONTO_BASE, [4_000_000, 350], [5_000_000, 450], [10_000_000, 550], [20_000_000, 650], [Infinity, 750]],
  'apr-dec': [...TORONTO_BASE, [4_000_000, 440], [5_000_000, 545], [10_000_000, 650], [20_000_000, 755], [Infinity, 860]],
};

function progressiveTax(priceCents, brackets) {
  let previousLimit = 0;
  let weightedCents = 0;
  for (const [limit, basisPoints] of brackets) {
    const upper = Math.min(priceCents, limit * 100);
    weightedCents += (upper - previousLimit) * basisPoints;
    if (upper === priceCents) break;
    previousLimit = upper;
  }
  return Math.round(weightedCents / 10_000);
}

/**
 * Estimate residential closing taxes for one or two single-family residences.
 * Pass the ownership share that qualifies for a rebate at registration (0–100).
 * The municipal surcharge option applies to the Toronto comparison even when
 * the property selected is outside Toronto. Amounts are returned in CAD.
 */
export function calculateLandTransferTax({
  purchasePrice,
  inToronto = false,
  registrationPeriod = 'apr-dec',
  eligibleSharePercent = 0,
  applyNrst = false,
  applyMnrst = false,
}) {
  const priceCents = Math.round(purchasePrice * 100);
  const eligibleShareBasisPoints = Math.round(eligibleSharePercent * 100);
  if (purchasePrice !== priceCents / 100 || !Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 100_000_000_000) {
    throw new RangeError('Enter a purchase price from $0.01 to $1 billion, with up to two decimal places.');
  }
  if (eligibleSharePercent !== eligibleShareBasisPoints / 100 || !Number.isInteger(eligibleShareBasisPoints) ||
      eligibleShareBasisPoints < 0 || eligibleShareBasisPoints > 10_000) {
    throw new RangeError('Enter an eligible ownership share from 0% to 100%, with up to two decimal places.');
  }
  if (!Object.hasOwn(TORONTO_BRACKETS, registrationPeriod)) throw new RangeError('Choose a 2026 registration period.');
  if (![inToronto, applyNrst, applyMnrst].every(value => typeof value === 'boolean')) {
    throw new RangeError('Choose whether each location and surcharge option applies.');
  }

  const ontarioTax = progressiveTax(priceCents, ONTARIO_BRACKETS);
  const municipalTax = progressiveTax(priceCents, TORONTO_BRACKETS[registrationPeriod]);
  const ontarioRefund = Math.round(Math.min(400_000, ontarioTax) * eligibleShareBasisPoints / 10_000);
  const municipalRefund = Math.round(Math.min(447_500, municipalTax) * eligibleShareBasisPoints / 10_000);
  const provincialSurcharge = applyNrst ? Math.round(priceCents / 4) : 0;
  const municipalSurcharge = applyMnrst ? Math.round(priceCents / 10) : 0;

  const outsideTorontoDue = ontarioTax - ontarioRefund + provincialSurcharge;
  const torontoPremium = municipalTax - municipalRefund + municipalSurcharge;
  const torontoDue = outsideTorontoDue + torontoPremium;
  const totalDue = inToronto ? torontoDue : outsideTorontoDue;
  const combinedRebates = ontarioRefund + (inToronto ? municipalRefund : 0);

  return {
    ontarioLtt: ontarioTax / 100,
    torontoMltt: inToronto ? municipalTax / 100 : 0,
    ontarioRebate: ontarioRefund / 100,
    torontoRebate: inToronto ? municipalRefund / 100 : 0,
    combinedRebates: combinedRebates / 100,
    ontarioNrst: provincialSurcharge / 100,
    torontoMnrst: inToronto ? municipalSurcharge / 100 : 0,
    totalDue: totalDue / 100,
    totalBeforeRebates: (totalDue + combinedRebates) / 100,
    effectiveRate: totalDue / priceCents,
    outsideTorontoDue: outsideTorontoDue / 100,
    torontoDue: torontoDue / 100,
    torontoPremium: torontoPremium / 100,
  };
}
