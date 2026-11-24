const MAX_PRICE = 100_000_000;
const BC_BANDS = [[200_000, 100], [2_000_000, 200], [3_000_000, 300], [Infinity, 500]];
const ONTARIO_BANDS = [[55_000, 50], [250_000, 100], [400_000, 150], [2_000_000, 200], [Infinity, 250]];
const TORONTO_COMMON_BANDS = [...ONTARIO_BANDS.slice(0, -1), [3_000_000, 250]];
const TORONTO_EARLY_BANDS = [
  ...TORONTO_COMMON_BANDS, [4_000_000, 350], [5_000_000, 450],
  [10_000_000, 550], [20_000_000, 650], [Infinity, 750]
];
const TORONTO_LATE_BANDS = [
  ...TORONTO_COMMON_BANDS, [4_000_000, 440], [5_000_000, 545],
  [10_000_000, 650], [20_000_000, 755], [Infinity, 860]
];

function isCurrency(amount, min, max) {
  return Number.isFinite(amount) && amount >= min && amount <= max &&
    Math.round(amount * 100) / 100 === amount;
}

// Multiply integer cents by integer basis points before rounding once per tax.
function taxCents(valueCents, bands) {
  let weightedCents = 0;
  let lowerCents = 0;
  for (const [upper, basisPoints] of bands) {
    const taxableCents = Math.min(valueCents, upper * 100) - lowerCents;
    weightedCents += taxableCents * basisPoints;
    if (valueCents <= upper * 100) break;
    lowerCents = upper * 100;
  }
  return Math.round(weightedCents / 10_000);
}

function comparison(gross, relief, albertaCents) {
  const net = gross - relief;
  return { gross: gross / 100, relief: relief / 100, net: net / 100, difference: (net - albertaCents) / 100 };
}

export function calculateComparison({
  purchasePrice, mortgageAmount = 0, firstTimeBuyer = false, torontoPeriod = 'apr-dec'
}) {
  if (!isCurrency(purchasePrice, 0.01, MAX_PRICE)) {
    throw new RangeError('Enter a purchase price from $0.01 to $100,000,000, with up to two decimal places.');
  }
  if (!isCurrency(mortgageAmount, 0, MAX_PRICE)) {
    throw new RangeError('Enter a mortgage principal from $0 to $100,000,000, with up to two decimal places.');
  }
  if (typeof firstTimeBuyer !== 'boolean' || !['jan-mar', 'apr-dec'].includes(torontoPeriod)) {
    throw new RangeError('Choose a first-time buyer setting and a 2026 Toronto registration period.');
  }

  const priceCents = Math.round(purchasePrice * 100);
  const mortgageCents = Math.round(mortgageAmount * 100);
  const transfer = 50 + Math.ceil(priceCents / 500_000) * 5;
  const mortgage = mortgageCents > 0 ? 50 + Math.ceil(mortgageCents / 500_000) * 5 : 0;
  const total = transfer + mortgage;
  const albertaCents = total * 100;

  const bcTax = taxCents(priceCents, BC_BANDS);
  const bcPhaseout = Math.min(2_500_000, Math.max(0, 86_000_000 - priceCents));
  const bcRelief = firstTimeBuyer ? Math.round(
    taxCents(Math.min(priceCents, 50_000_000), BC_BANDS) * bcPhaseout / 2_500_000
  ) : 0;

  const ontarioTax = taxCents(priceCents, ONTARIO_BANDS);
  const ontarioRelief = firstTimeBuyer ? Math.min(ontarioTax, 400_000) : 0;
  const municipalTax = taxCents(priceCents, torontoPeriod === 'jan-mar' ? TORONTO_EARLY_BANDS : TORONTO_LATE_BANDS);
  const municipalRelief = firstTimeBuyer ? Math.min(municipalTax, 447_500) : 0;

  return {
    alberta: { transfer, mortgage, total, share: total / purchasePrice },
    bc: comparison(bcTax, bcRelief, albertaCents),
    ontario: comparison(ontarioTax, ontarioRelief, albertaCents),
    toronto: {
      municipal: municipalTax / 100,
      ...comparison(ontarioTax + municipalTax, ontarioRelief + municipalRelief, albertaCents)
    }
  };
}
