// 2026 annual return brackets. Each row is [upper bound, marginal rate].
const federal = [[58523, .14], [117045, .205], [181440, .26], [258482, .29], [Infinity, .33]];

// Name, basic personal amount (null for a variable amount), DTC rates, brackets.
const regions = {
  AB: ['Alberta', 22769, [.0812, .0218], [[61200, .08], [154259, .10], [185111, .12], [246813, .13], [370220, .14], [Infinity, .15]]],
  BC: ['British Columbia', 13216, [.12, .0196], [[50363, .056], [100728, .077], [115648, .105], [140430, .1229], [190405, .147], [265545, .168], [Infinity, .205]]],
  MB: ['Manitoba', null, [.08, .007835], [[47000, .108], [100000, .1275], [Infinity, .174]]],
  NB: ['New Brunswick', 13664, [.14, .0275], [[52333, .094], [104666, .14], [193861, .16], [Infinity, .195]]],
  NL: ['Newfoundland and Labrador', 13094, [.063, .032], [[44678, .087], [89354, .145], [159528, .158], [223340, .178], [285319, .198], [570638, .208], [1141275, .213], [Infinity, .218]]],
  NS: ['Nova Scotia', 11932, [.0885, .015], [[30995, .0879], [61991, .1495], [97417, .1667], [157124, .175], [Infinity, .21]]],
  NT: ['Northwest Territories', 18198, [.115, .06], [[53003, .059], [106009, .086], [172346, .122], [Infinity, .1405]]],
  NU: ['Nunavut', 19659, [.0551, .0261], [[55801, .04], [111602, .07], [181439, .09], [Infinity, .115]]],
  ON: ['Ontario', 12989, [.10, .029863], [[53891, .0505], [107785, .0915], [150000, .1116], [220000, .1216], [Infinity, .1316]]],
  PE: ['Prince Edward Island', 15000, [.105, .013], [[33928, .095], [65820, .1347], [106890, .166], [142520, .1762], [200000, .19], [Infinity, .20]]],
  QC: ['Quebec', 18952, [.117, .0342], [[54345, .14], [108680, .19], [132245, .24], [Infinity, .2575]]],
  SK: ['Saskatchewan', 20381, [.11, .02519], [[54532, .105], [155805, .125], [Infinity, .145]]],
  YT: ['Yukon', null, [.1202, .0067], [[58523, .064], [117045, .09], [181440, .109], [500000, .128], [Infinity, .15]]],
};

export const jurisdictions = Object.freeze(Object.entries(regions).map(([code, [name, , rates]]) =>
  Object.freeze({ code, name, eligible: rates[0], nonEligible: rates[1] })));
export const OAS_THRESHOLD = 95323;
export const OAS_RATE = .15;
export const DEFAULT_OAS_PENSION = 8999.49;
export const MAX_INPUT = 100_000_000;

const dividendTypes = {
  eligible: { multiplier: 1.38, federalRate: .150198, regionalIndex: 0 },
  non_eligible: { multiplier: 1.15, federalRate: .090301, regionalIndex: 1 },
};
const positive = n => Math.max(0, n);
const cents = n => Math.round(n * 100) / 100 || 0;

function bracketTax(income, brackets) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of brackets) {
    tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

function ontarioPremium(income) {
  return Math.min(300, positive(income - 20000) * .06)
    + Math.min(150, positive(income - 36000) * .06)
    + Math.min(150, positive(income - 48000) * .25)
    + Math.min(150, positive(income - 72000) * .25)
    + Math.min(150, positive(income - 200000) * .25);
}

function incomeTax(income, province, federalCredit = 0, regionalCredit = 0) {
  const [, basicAmount, , brackets] = regions[province];
  const federalBpa = 16452 - Math.min(1623, positive(income - 181440) * 1623 / 77042);
  const regionalBpa = province === 'MB'
    ? 15780 * positive(1 - positive(income - 200000) / 200000)
    : basicAmount ?? federalBpa;
  let federalTax = positive(bracketTax(income, federal) - federalBpa * .14 - federalCredit);
  if (province === 'QC') federalTax *= .835;

  let regionalTax = positive(bracketTax(income, brackets) - regionalBpa * brackets[0][1]);
  if (province === 'ON') {
    regionalTax += .20 * positive(regionalTax - 5818) + .36 * positive(regionalTax - 7446);
    regionalTax = positive(regionalTax - regionalCredit);
    regionalTax = positive(regionalTax - positive(600 - regionalTax));
    return federalTax + regionalTax + ontarioPremium(income);
  }
  if (province === 'BC') regionalTax -= positive(690 - positive(income - 25570) * .0356);
  return federalTax + positive(regionalTax - regionalCredit);
}

export function calculateDividend({
  province, type, cashDividend, otherIncome, receivingOas = false, oasPension = DEFAULT_OAS_PENSION,
}) {
  if (!Object.hasOwn(regions, province) || !Object.hasOwn(dividendTypes, type)) {
    throw new RangeError('Select a supported jurisdiction and dividend type.');
  }
  if (typeof receivingOas !== 'boolean' || [cashDividend, otherIncome, oasPension]
    .some(amount => !Number.isFinite(amount) || amount < 0 || amount > MAX_INPUT)
    || (receivingOas && oasPension > otherIncome)) {
    throw new RangeError('Enter valid annual amounts and include gross OAS in other income.');
  }
  const { multiplier, federalRate, regionalIndex } = dividendTypes[type];
  const taxableDividend = cents(cashDividend * multiplier);
  const federalCredit = cents(taxableDividend * federalRate);
  const regionalCredit = cents(taxableDividend * regions[province][2][regionalIndex]);
  const recovery = income => receivingOas
    ? cents(Math.min(oasPension, OAS_RATE * positive(income - OAS_THRESHOLD)))
    : 0;

  const line23400 = cents(otherIncome + taxableDividend);
  const baselineRecovery = recovery(otherIncome);
  const cashOnlyRecovery = recovery(otherIncome + cashDividend);
  const totalRecovery = recovery(line23400);
  const dividendRecovery = cents(totalRecovery - baselineRecovery);
  const grossUpRecovery = cents(totalRecovery - cashOnlyRecovery);
  const baselineTax = incomeTax(otherIncome - baselineRecovery, province);
  const netDividendTax = cents(incomeTax(line23400 - totalRecovery, province, federalCredit, regionalCredit) - baselineTax);
  const allInCost = cents(netDividendTax + dividendRecovery);

  const taxableCapitalGain = cents(cashDividend * .5);
  const capitalGainIncome = otherIncome + taxableCapitalGain;
  const capitalGainRecovery = recovery(capitalGainIncome);
  const capitalGainCost = cents(incomeTax(capitalGainIncome - capitalGainRecovery, province)
    - baselineTax + capitalGainRecovery - baselineRecovery);

  return {
    taxableDividend, federalCredit, regionalCredit, totalCredit: cents(federalCredit + regionalCredit),
    line23400, netDividendTax,
    effectiveTaxRate: cashDividend ? netDividendTax / cashDividend : null,
    baselineRecovery, cashOnlyRecovery, totalRecovery, dividendRecovery, grossUpRecovery,
    allInCost, allInRate: cashDividend ? allInCost / cashDividend : null,
    taxableAccountNet: cents(cashDividend - allInCost), tfsaNet: cashDividend,
    taxableCapitalGain, capitalGainCost, capitalGainNet: cents(cashDividend - capitalGainCost),
  };
}
