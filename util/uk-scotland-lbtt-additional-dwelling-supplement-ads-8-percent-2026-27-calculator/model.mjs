const MAX_PRICE = 100_000_000;
const ADDITIONAL_THRESHOLD = 40_000;
const SCOTLAND_RESIDENTIAL = [[145_000, 0], [250_000, 2], [325_000, 5], [750_000, 10], [Infinity, 12]];
const SCOTLAND_FIRST_TIME = [[175_000, 0], ...SCOTLAND_RESIDENTIAL.slice(1)];
const SCOTLAND_COMMERCIAL = [[150_000, 0], [250_000, 1], [Infinity, 5]];
const ENGLAND_RESIDENTIAL = [[125_000, 0], [250_000, 2], [925_000, 5], [1_500_000, 10], [Infinity, 12]];
const ENGLAND_FIRST_TIME = [[300_000, 0], [Infinity, 5]];
const ENGLAND_COMMERCIAL = [[150_000, 0], [250_000, 2], [Infinity, 5]];
const SCENARIOS = ['standard', 'first-time', 'additional', 'replacement', 'commercial'];

export function parsePrice(input) {
  const trimmed = input.trim();
  if (!/^£?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const price = Number(trimmed.replace(/[£,]/g, ''));
  return price <= MAX_PRICE ? price : null;
}

// A penny multiplied by an integer percentage gives hundredths of a penny.
function bandTax(pricePence, bands) {
  let total = 0;
  let lowerPence = 0;
  for (const [upper, rate] of bands) {
    const upperPence = upper * 100;
    total += Math.max(0, Math.min(pricePence, upperPence) - lowerPence) * rate;
    lowerPence = upperPence;
  }
  return total;
}

function taxSummary(standard, relieved, surcharge, qualifyingReplacement) {
  const upfront = Math.floor((relieved + surcharge) / 10_000);
  const afterRefund = qualifyingReplacement ? Math.floor(relieved / 10_000) : upfront;
  return {
    base: relieved / 10_000,
    relief: (standard - relieved) / 10_000,
    surcharge: surcharge / 10_000,
    upfront,
    refund: upfront - afterRefund,
    afterRefund,
  };
}

// The replacement flag assumes the applicable occupancy and disposal conditions are met.
export function compareTaxes(price, scenario = 'standard', qualifyingSaleWithinWindow = true) {
  const pricePence = Math.round(price * 100);
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE || pricePence / 100 !== price) {
    throw new RangeError('Enter a purchase price in pounds and pence.');
  }
  if (!SCENARIOS.includes(scenario)) throw new RangeError('Choose a supported purchase scenario.');

  const commercial = scenario === 'commercial';
  const firstTime = scenario === 'first-time';
  const higherRates = (scenario === 'additional' || scenario === 'replacement') && price >= ADDITIONAL_THRESHOLD;
  const qualifyingReplacement = scenario === 'replacement' && qualifyingSaleWithinWindow;
  const scotlandStandard = bandTax(pricePence, commercial ? SCOTLAND_COMMERCIAL : SCOTLAND_RESIDENTIAL);
  const englandStandard = bandTax(pricePence, commercial ? ENGLAND_COMMERCIAL : ENGLAND_RESIDENTIAL);
  const scotlandRelieved = firstTime ? bandTax(pricePence, SCOTLAND_FIRST_TIME) : scotlandStandard;
  const englandRelieved = firstTime && price <= 500_000 ? bandTax(pricePence, ENGLAND_FIRST_TIME) : englandStandard;
  const scotland = taxSummary(scotlandStandard, scotlandRelieved, higherRates ? pricePence * 8 : 0, qualifyingReplacement);
  const englandNI = taxSummary(englandStandard, englandRelieved, higherRates ? pricePence * 5 : 0, qualifyingReplacement);

  return { scotland, englandNI, difference: scotland.upfront - englandNI.upfront };
}
