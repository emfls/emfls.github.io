// Band ceilings are in pounds. Rates are expressed as percentages.
const WALES_MAIN = [[225000, 0], [400000, 6], [750000, 7.5], [1500000, 10], [Infinity, 12]];
const WALES_HIGHER = [[180000, 5], [250000, 8.5], [400000, 10], [750000, 12.5], [1500000, 15], [Infinity, 17]];
const WALES_COMMERCIAL = [[225000, 0], [250000, 1], [1000000, 5], [Infinity, 6]];

const SDLT_MAIN = [[125000, 0], [250000, 2], [925000, 5], [1500000, 10], [Infinity, 12]];
const SDLT_FIRST_TIME = [[300000, 0], [Infinity, 5]];
const SDLT_HIGHER = [[125000, 5], [250000, 7], [925000, 10], [1500000, 15], [Infinity, 17]];
const SDLT_COMMERCIAL = [[150000, 0], [250000, 2], [Infinity, 5]];

const MAX_PRICE_PENCE = 100000000000; // £1 billion keeps all intermediate calculations exact.
export const HIGHER_THRESHOLD_PENCE = 4000000;
const FIRST_TIME_CAP_PENCE = 50000000;
const SCENARIOS = new Set(['main', 'first-time', 'higher', 'commercial']);
const PRICE_PATTERN = /^£?(?:(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/;

export function parsePrice(input) {
  if (typeof input !== 'string') return null;

  const match = PRICE_PATTERN.exec(input.trim());
  if (!match) return null;

  const [, whole = '0', fraction, leadingFraction] = match;
  const pence = Number(whole.replaceAll(',', '')) * 100
    + Number((fraction ?? leadingFraction ?? '').padEnd(2, '0'));

  return isValidPrice(pence) ? pence : null;
}

function isValidPrice(pence) {
  return Number.isSafeInteger(pence) && pence >= 0 && pence <= MAX_PRICE_PENCE;
}

function unroundedTax(pricePence, bands) {
  // Accumulate in thousandths of a penny so there is no floating-point band rounding.
  let total = 0;
  let lowerPence = 0;
  for (const [upperPounds, percent] of bands) {
    const upperPence = upperPounds * 100;
    const portion = Math.min(pricePence, upperPence) - lowerPence;
    total += portion * (percent * 10);
    if (pricePence <= upperPence) break;
    lowerPence = upperPence;
  }
  return total;
}

function walesTax(pricePence, bands) {
  return Math.round(unroundedTax(pricePence, bands) / 1000);
}

function sdltTax(pricePence, bands) {
  // HMRC rounds the final SDLT liability down to whole pounds.
  return Math.floor(unroundedTax(pricePence, bands) / 100000) * 100;
}

export function compareTaxes(pricePence, scenario) {
  if (!isValidPrice(pricePence) || !SCENARIOS.has(scenario)) return null;

  const usesFirstTimeRelief = scenario === 'first-time' && pricePence <= FIRST_TIME_CAP_PENCE;
  let walesPence;
  let sdltPence;
  let refundPence = null;

  switch (scenario) {
    case 'higher': {
      const mainPence = walesTax(pricePence, WALES_MAIN);
      const chargeHigherRates = pricePence >= HIGHER_THRESHOLD_PENCE;
      walesPence = chargeHigherRates ? walesTax(pricePence, WALES_HIGHER) : 0;
      sdltPence = chargeHigherRates ? sdltTax(pricePence, SDLT_HIGHER) : 0;
      refundPence = walesPence - mainPence;
      break;
    }
    case 'commercial':
      walesPence = walesTax(pricePence, WALES_COMMERCIAL);
      sdltPence = sdltTax(pricePence, SDLT_COMMERCIAL);
      break;
    default:
      walesPence = walesTax(pricePence, WALES_MAIN);
      sdltPence = sdltTax(pricePence, usesFirstTimeRelief ? SDLT_FIRST_TIME : SDLT_MAIN);
  }

  return {
    walesPence,
    sdltPence,
    differencePence: walesPence - sdltPence,
    refundPence,
    usesFirstTimeRelief,
  };
}
