export const DC_LIMITS = Object.freeze({
  early: Object.freeze({
    price: 777000,
    agi: Object.freeze([206640, 236160, 265680, 295020, 318780, 342360, 365940, 389520])
  }),
  late: Object.freeze({
    price: 794000,
    agi: Object.freeze([209340, 239220, 269100, 298980, 322920, 346860, 370800, 394740])
  })
});

export const MD_COUNTIES = Object.freeze({
  montgomery: Object.freeze({ name: 'Montgomery County', transferPercent: 1, recordationPerThousand: 8.9 }),
  princeGeorge: Object.freeze({ name: 'Prince George’s County', transferPercent: 1.4, recordationPerThousand: 5.5 }),
  anneArundel: Object.freeze({ name: 'Anne Arundel County', transferPercent: 1, recordationPerThousand: 7 }),
  howard: Object.freeze({ name: 'Howard County', transferPercent: 1.25, recordationPerThousand: 5 }),
  baltimoreCity: Object.freeze({ name: 'Baltimore City', transferPercent: 1.5, recordationPerThousand: 10 })
});

function units(value, scale, min, max, label) {
  const integer = Math.round(value * scale);
  if (!Number.isFinite(value) || value < min || value > max || integer / scale !== value) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return integer;
}

const maxDollars = 100_000_000;
const priceInCents = price => units(price, 100, 0.01, maxDollars, 'purchase price');
const dollars = cents => cents / 100;

export function calculateDC({ price, agi, household, firstTime = false, period = 'late' }) {
  const priceCents = priceInCents(price);
  units(agi, 100, -maxDollars, maxDollars, 'federal AGI');
  if (!Number.isSafeInteger(household) || household < 1 || !Object.hasOwn(DC_LIMITS, period)) {
    throw new RangeError('Choose a valid household size and recording period.');
  }
  const limits = DC_LIMITS[period];
  const agiCap = limits.agi[household - 1] ?? null;
  const exceedsLimits = price > limits.price || (agiCap !== null && agi > agiCap);
  let eligibility = 'QUALIFIED_0_725_PCT';
  if (!firstTime) eligibility = 'DISQUALIFIED_HOMESTEAD_OR_HISTORY';
  else if (exceedsLimits) eligibility = 'DISQUALIFIED_PRICE_OR_AGI';
  else if (agiCap === null) eligibility = 'INCOME_CAP_UNAVAILABLE';

  const standardRate = price < 400000 ? 1100 : 1450;
  const recordationRate = eligibility === 'QUALIFIED_0_725_PCT' ? 725 : standardRate;
  const recordation = Math.round(priceCents * recordationRate / 100000);
  const transfer = Math.round(priceCents * standardRate / 100000);
  return {
    eligibility,
    priceCap: limits.price,
    agiCap,
    recordationPercent: recordationRate / 1000,
    buyerRecordation: dollars(recordation),
    sellerTransfer: dollars(transfer),
    buyerTotal: dollars(recordation),
    sellerTotal: dollars(transfer),
    total: dollars(recordation + transfer),
    buyerRelief: dollars(transfer - recordation)
  };
}

// Rates are cents per $500 or fraction, applied to each portion of the price.
const montgomeryBands = [
  [0, 500000, 445],
  [500000, 600000, 675],
  [600000, 750000, 1020],
  [750000, 1000000, 1078],
  [1000000, Infinity, 1135]
];

function montgomeryRecordation(priceCents, exemptionCents) {
  return montgomeryBands.reduce((tax, [lower, upper, rate]) => {
    const taxable = Math.max(0, Math.min(priceCents, upper * 100) - Math.max(lower * 100, exemptionCents));
    return tax + Math.ceil(taxable / 50000) * rate;
  }, 0);
}

export function calculateMaryland({
  price, county, firstTime = false, montgomeryExemption = false,
  transferPercent, recordationPerThousand, buyerLocalPercent = 50,
  transferDeduction = 0, recordationDeduction = 0
}) {
  const priceCents = priceInCents(price);
  if (!Object.hasOwn(MD_COUNTIES, county)) throw new RangeError('Choose a Maryland county or city.');
  const rates = MD_COUNTIES[county];
  const automaticTransfer = county === 'anneArundel' && price >= 1000000 ? 1.5 : rates.transferPercent;
  const transferRate = units(transferPercent ?? automaticTransfer, 1000, 0, 100, 'local transfer rate');
  const recordationRate = units(recordationPerThousand ?? rates.recordationPerThousand, 1000, 0, 1000, 'recordation rate');
  const buyerShare = units(buyerLocalPercent, 100, 0, 100, 'buyer share');
  const transferBase = Math.max(0, priceCents - units(transferDeduction, 100, 0, maxDollars, 'transfer deduction'));
  const exemption = county === 'montgomery' && montgomeryExemption ? 10000000 : 0;
  const recordationExempt = exemption + units(recordationDeduction, 100, 0, maxDollars, 'recordation deduction');

  const state = Math.round(priceCents / (firstTime ? 400 : 200));
  const buyerState = firstTime ? 0 : Math.round(state / 2);
  const transfer = Math.round(transferBase * transferRate / 100000);
  const recordation = county === 'montgomery' && recordationPerThousand === undefined
    ? montgomeryRecordation(priceCents, recordationExempt)
    : Math.round(Math.ceil(Math.max(0, priceCents - recordationExempt) / 50000) * recordationRate / 20);
  const yieldTax = county === 'baltimoreCity' && price > 1000000
    ? Math.round((recordation * 15 + transfer * 40) / 100)
    : 0;

  const buyerTransfer = Math.round(transfer * buyerShare / 10000);
  const buyerRecordation = Math.round(recordation * buyerShare / 10000);
  const buyerYield = Math.round(yieldTax * buyerShare / 10000);
  const total = state + transfer + recordation + yieldTax;
  const buyerTotal = buyerState + buyerTransfer + buyerRecordation + buyerYield;
  return {
    stateTransfer: dollars(state),
    buyerState: dollars(buyerState),
    sellerState: dollars(state - buyerState),
    countyTransfer: dollars(transfer),
    buyerTransfer: dollars(buyerTransfer),
    sellerTransfer: dollars(transfer - buyerTransfer),
    countyRecordation: dollars(recordation),
    buyerRecordation: dollars(buyerRecordation),
    sellerRecordation: dollars(recordation - buyerRecordation),
    yieldTax: dollars(yieldTax),
    buyerYield: dollars(buyerYield),
    sellerYield: dollars(yieldTax - buyerYield),
    buyerTotal: dollars(buyerTotal),
    sellerTotal: dollars(total - buyerTotal),
    total: dollars(total)
  };
}

export function compareClosingTaxes(dcInputs, mdInputs) {
  const dc = calculateDC(dcInputs);
  const md = calculateMaryland(mdInputs);
  return {
    dc,
    md,
    buyerSavingsInMaryland: dollars(Math.round(dc.buyerTotal * 100) - Math.round(md.buyerTotal * 100))
  };
}
