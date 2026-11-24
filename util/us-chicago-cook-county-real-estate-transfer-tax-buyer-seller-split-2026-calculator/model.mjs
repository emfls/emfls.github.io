const MIN_PRICE = 500;
const MAX_PRICE = 1_000_000_000;
const STATE_CENTS_PER_STAMP = 50;
const COUNTY_CENTS_PER_STAMP = 25;

const presets = {
  chicago: { label: 'Chicago', county: 'Cook', buyerRate500: 375, ctaRate500: 150 },
  evanston: { label: 'Evanston', county: 'Cook' },
  'oak-park': { label: 'Oak Park', county: 'Cook', sellerRate1000: 800 },
  skokie: { label: 'Skokie', county: 'Cook', sellerRate1000: 300 },
  naperville: { label: 'Naperville', county: 'DuPage / Will', buyerRate500: 150 },
  'county-only': { label: 'No municipal tax', county: 'DuPage / Lake / Will' },
};

function isSupportedPrice(price) {
  return Number.isFinite(price) && price >= MIN_PRICE && price <= MAX_PRICE
    && Math.round(price * 100) / 100 === price;
}

export function parseSalePrice(value) {
  const input = value.trim();
  if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(input)) return null;
  const price = Number(input.replace(/[$,]/g, ''));
  return isSupportedPrice(price) ? price : null;
}

function evanstonMunicipalTaxCents(salePrice) {
  // One rate applies to the whole sale price. Evanston's posted schedule quotes
  // rates by value, so prorate the $1,000 unit and round the result to cents.
  const rate = salePrice <= 1_500_000 ? 5 : salePrice <= 5_000_000 ? 7 : 9;
  return Math.round(Math.round(salePrice * 100) * rate / 1000);
}

export function calculateTransferTax(salePrice, preset = 'chicago') {
  if (!isSupportedPrice(salePrice)) throw new RangeError('Unsupported sale price.');
  if (!Object.hasOwn(presets, preset)) throw new RangeError('Unknown municipality.');

  const { label, county, buyerRate500 = 0, ctaRate500 = 0, sellerRate1000 = 0 } = presets[preset];
  const units500 = Math.ceil(salePrice / 500);
  const buyerCents = units500 * buyerRate500;
  const municipalSellerCents = preset === 'evanston'
    ? evanstonMunicipalTaxCents(salePrice)
    : Math.ceil(salePrice / 1000) * sellerRate1000;
  const municipalCents = buyerCents + municipalSellerCents;
  const ctaCents = units500 * ctaRate500;
  const countyCents = units500 * COUNTY_CENTS_PER_STAMP;
  const stateCents = units500 * STATE_CENTS_PER_STAMP;
  const sellerCents = municipalSellerCents + ctaCents + countyCents + stateCents;
  const totalCents = buyerCents + sellerCents;

  return {
    preset, label, county, units500, municipalCents, ctaCents, countyCents, stateCents,
    buyerCents, sellerCents, totalCents,
    buyerPercent: buyerCents / salePrice,
    sellerPercent: sellerCents / salePrice,
    totalPercent: totalCents / salePrice,
  };
}

export function compareTransferTaxes(salePrice) {
  const chicago = calculateTransferTax(salePrice);
  const scenarios = [chicago, ...Object.keys(presets).slice(1).map(preset => calculateTransferTax(salePrice, preset))];
  return scenarios.map(scenario => ({ ...scenario, savingsCents: chicago.totalCents - scenario.totalCents }));
}
