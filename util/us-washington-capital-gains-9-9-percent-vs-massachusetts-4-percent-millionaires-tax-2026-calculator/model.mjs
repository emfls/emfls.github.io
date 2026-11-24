// Inputs are US dollars to the cent. Internally, rates in thousandths
// multiplied by cents keep boundary comparisons and gain allocations exact.
export const MAX_AMOUNT = 1_000_000_000;
export const WA_DEDUCTION = 290_000;
export const WA_GIFT_CAP = 116_000;
export const WA_TIER = 1_000_000;
export const MA_THRESHOLD = 1_107_750;
export const MAX_YEARS = 30;

const profiles = {
  single: { maExemption: 4400, caDeduction: 5900 },
  joint: { maExemption: 8800, caDeduction: 11800 },
};

const caRates = [10, 20, 40, 60, 80, 93, 103, 113, 123];
const caSchedules = {
  single: [
    [0, 0], [11456, 114.56], [27157, 428.58], [42861, 1056.74],
    [59498, 2054.96], [75197, 3310.88], [384109, 32039.70],
    [460927, 39951.95], [768213, 74675.27],
  ],
  joint: [
    [0, 0], [22912, 229.12], [54314, 857.16], [85722, 2113.48],
    [118996, 4109.92], [150394, 6621.76], [768218, 64079.39],
    [921854, 79903.90], [1536426, 149350.54],
  ],
};

const cents = amount => Math.round(amount * 100);
const dollars = amount => amount / 100;
const taxDollars = units => dollars(Math.round(units / 1000));
const positive = amount => Math.max(0, amount);

function money(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT ||
      dollars(cents(amount)) !== amount) {
    throw new RangeError('Enter nonnegative dollar amounts with up to two decimal places.');
  }
  return cents(amount);
}

function inputs({ wages = 0, shortGain = 0, longGain = 0, realEstateGain = 0,
                  gifts = 0, filing = 'single' } = {}) {
  if (!Object.hasOwn(profiles, filing)) {
    throw new RangeError('Select single or married filing jointly.');
  }
  return {
    wages: money(wages), shortGain: money(shortGain), longGain: money(longGain),
    realEstateGain: money(realEstateGain), gifts: money(gifts), filing,
  };
}

function waTax(longGain, gifts) {
  const charitable = Math.min(cents(WA_GIFT_CAP), positive(gifts - cents(WA_DEDUCTION)));
  const taxable = positive(longGain - cents(WA_DEDUCTION) - charitable);
  return { taxable, charitable, base: taxable * 70, extra: positive(taxable - cents(WA_TIER)) * 29 };
}

function maTax({ wages, shortGain, longGain, realEstateGain, filing }) {
  const exemption = cents(profiles[filing].maExemption);
  const unusedAfterWages = positive(exemption - wages);
  const shortTaxable = positive(shortGain - unusedAfterWages);
  const longTaxable = positive(longGain + realEstateGain - positive(unusedAfterWages - shortGain));
  const ordinaryTaxable = positive(wages - exemption);
  const taxable = ordinaryTaxable + shortTaxable + longTaxable;
  return {
    taxable,
    base: (ordinaryTaxable + longTaxable) * 50 + shortTaxable * 85,
    extra: positive(taxable - cents(MA_THRESHOLD)) * 40,
  };
}

function caTax({ wages, shortGain, longGain, realEstateGain, filing }) {
  const taxable = positive(wages + shortGain + longGain + realEstateGain -
    cents(profiles[filing].caDeduction));
  const schedule = caSchedules[filing];
  const bracket = schedule.findLastIndex(([floor]) => taxable >= cents(floor));
  const [floor, anchor] = schedule[bracket];
  return {
    taxable,
    base: cents(anchor) * 1000 + (taxable - cents(floor)) * caRates[bracket],
    extra: positive(taxable - cents(1_000_000)) * 10,
    sdi: wages * 13,
  };
}

function summarize({ taxable, base, extra }) {
  return {
    taxable: dollars(taxable),
    baseTax: taxDollars(base),
    surtax: taxDollars(extra),
    total: taxDollars(base + extra),
  };
}

function summarizeWa(tax) {
  return { ...summarize(tax), charitableDeduction: dollars(tax.charitable) };
}

function summarizeCa(tax) {
  return { ...summarize(tax), sdi: taxDollars(tax.sdi), withSdi: taxDollars(tax.base + tax.extra + tax.sdi) };
}

export function washington(longGain = 0, gifts = 0) {
  return summarizeWa(waTax(money(longGain), money(gifts)));
}

export function massachusetts(scenario) {
  return summarize(maTax(inputs(scenario)));
}

export function california(scenario) {
  return summarizeCa(caTax(inputs(scenario)));
}

export function compare(scenario) {
  const data = inputs(scenario);
  const taxes = {
    wa: summarizeWa(waTax(data.longGain, data.gifts)),
    ma: summarize(maTax(data)),
    ca: summarizeCa(caTax(data)),
    zero: summarize({ taxable: 0, base: 0, extra: 0 }),
  };
  const lowest = Math.min(...Object.values(taxes).map(({ total }) => total));
  const winners = Object.keys(taxes).filter(state => taxes[state].total === lowest);
  return { taxes, winners };
}

export function timing(scenario, years) {
  if (!Number.isInteger(years) || years < 1 || years > MAX_YEARS) {
    throw new RangeError('Enter a whole number of years from 1 to 30.');
  }
  const data = inputs(scenario);
  const regularPortion = Math.floor(data.longGain / years);
  const remainder = data.longGain % years;
  const annualGains = Array.from({ length: years }, (_, year) => regularPortion + Number(year < remainder));

  const firstYear = { ...data, longGain: 0 };
  const laterYear = { ...firstYear, shortGain: 0, realEstateGain: 0, gifts: 0 };
  const sizeWaRoom = year => cents(WA_DEDUCTION) + waTax(0, year.gifts).charitable;
  // Headroom includes any unused personal exemption, even when taxable income is already zero.
  const sizeMaRoom = year => positive(cents(MA_THRESHOLD + profiles[year.filing].maExemption) -
    year.wages - year.shortGain - year.realEstateGain);
  const waOneYear = waTax(data.longGain, data.gifts);
  const lumpWa = waOneYear.base + waOneYear.extra;
  const lumpMa = maTax(data);
  let splitWa = 0;
  let splitMa = 0;
  let splitMaSurtax = 0;

  for (const [year, longGain] of annualGains.entries()) {
    const baseYear = year === 0 ? firstYear : laterYear;
    const wa = waTax(longGain, baseYear.gifts);
    const ma = maTax({ ...baseYear, longGain });
    splitWa += wa.base + wa.extra;
    splitMa += ma.base + ma.extra;
    splitMaSurtax += ma.extra;
  }

  const maRecurring = maTax(laterYear);
  const lumpMaTotal = lumpMa.base + lumpMa.extra +
    (years - 1) * (maRecurring.base + maRecurring.extra);
  return {
    annualGains: annualGains.map(dollars),
    wa: {
      lumpTax: taxDollars(lumpWa), splitTax: taxDollars(splitWa),
      savings: taxDollars(lumpWa - splitWa),
      firstYearRoom: dollars(sizeWaRoom(firstYear)), laterYearRoom: dollars(sizeWaRoom(laterYear)),
    },
    ma: {
      lumpTax: taxDollars(lumpMaTotal), splitTax: taxDollars(splitMa),
      savings: taxDollars(lumpMaTotal - splitMa), splitSurtax: taxDollars(splitMaSurtax),
      firstYearRoom: dollars(sizeMaRoom(firstYear)), laterYearRoom: dollars(sizeMaRoom(laterYear)),
    },
  };
}
