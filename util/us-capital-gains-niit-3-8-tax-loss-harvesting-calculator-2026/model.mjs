// Rev. Proc. 2025-32 §4.01, §4.03 and §4.14. NIIT limits are set by IRC §1411.
const ordinaryRates = [10, 12, 22, 24, 32, 35, 37];
export const parameters = Object.freeze({
  single: Object.freeze({
    standard: 16100, zero: 49450, fifteen: 545500, niit: 200000, lossLimit: 3000,
    ordinary: Object.freeze([12400, 50400, 105700, 201775, 256225, 640600]),
  }),
  mfj: Object.freeze({
    standard: 32200, zero: 98900, fifteen: 613700, niit: 250000, lossLimit: 3000,
    ordinary: Object.freeze([24800, 100800, 211400, 403550, 512450, 768700]),
  }),
  hoh: Object.freeze({
    standard: 24150, zero: 66200, fifteen: 579600, niit: 200000, lossLimit: 3000,
    ordinary: Object.freeze([17700, 67450, 105700, 201750, 256200, 640600]),
  }),
  mfs: Object.freeze({
    standard: 16100, zero: 49450, fifteen: 306850, niit: 125000, lossLimit: 1500,
    ordinary: Object.freeze([12400, 50400, 105700, 201775, 256225, 384350]),
  }),
});

const positive = (value) => Math.max(0, value);
export const maxDollarInput = 1000000000;

function cents(value, name, signed = false) {
  const amount = Math.round(value * 100);
  if (!Number.isFinite(value) || Math.abs(value) > maxDollarInput ||
      (!signed && value < 0) || Math.abs(value * 100 - amount) > 0.00002) {
    throw new RangeError(`${name} must be a valid dollar amount with up to two decimal places.`);
  }
  return amount || 0;
}

function ordinaryTax(taxable, ceilings) {
  let lower = 0;
  return ordinaryRates.reduce((tax, rate, index) => {
    const upper = index < ceilings.length ? ceilings[index] * 100 : Infinity;
    const slice = positive(Math.min(taxable, upper) - lower);
    lower = upper;
    return tax + 10 * rate * slice;
  }, 0);
}

function assess(netST, netLT, inputs, rules) {
  const combinedNet = netST + netLT;
  const shortGain = positive(Math.min(netST, combinedNet));
  const longGain = positive(Math.min(netLT, combinedNet));
  const lossDeduction = Math.min(positive(-combinedNet), rules.lossLimit * 100);
  const capitalForAgi = positive(combinedNet) - lossDeduction;
  const agi = inputs.ordinaryIncome + inputs.qualifiedDividends + capitalForAgi;
  const beforeTaxableFloor = agi - inputs.deduction;
  const taxableIncome = positive(beforeTaxableFloor);
  const preferential = Math.min(taxableIncome, longGain + inputs.qualifiedDividends);
  const ordinaryTaxable = taxableIncome - preferential;
  const atZero = Math.min(preferential, positive(rules.zero * 100 - ordinaryTaxable));
  const atFifteen = Math.min(preferential - atZero,
    positive(rules.fifteen * 100 - ordinaryTaxable - atZero));
  const atTwenty = preferential - atZero - atFifteen;

  // Schedule D carryover worksheet uses taxable income before its zero floor.
  // The allowable deduction consumes surviving short-term losses first.
  const lossUsed = Math.min(lossDeduction, positive(beforeTaxableFloor + lossDeduction));
  const shortLoss = positive(-netST - positive(netLT));
  const longLoss = positive(-netLT - positive(netST));
  const carryST = positive(shortLoss - lossUsed);
  const carryLT = positive(longLoss - positive(lossUsed - shortLoss));

  const magi = agi + inputs.magiAdjustment;
  const netInvestmentIncome = inputs.otherInvestmentIncome + inputs.qualifiedDividends + capitalForAgi;
  const niitBase = Math.min(positive(netInvestmentIncome), positive(magi - rules.niit * 100));

  // Store tax in thousandths of a cent so cents-precision scenarios compare exactly.
  const niit = 38 * niitBase;
  const preferentialTax = 150 * atFifteen + 200 * atTwenty;
  const taxOnOrdinary = ordinaryTax(ordinaryTaxable, rules.ordinary);
  const regularTax = Math.min(taxOnOrdinary + preferentialTax, ordinaryTax(taxableIncome, rules.ordinary));
  const ordinaryWithoutST = positive(inputs.ordinaryIncome - inputs.deduction);
  const shortGainTax = shortGain > 0
    ? taxOnOrdinary - ordinaryTax(ordinaryWithoutST, rules.ordinary)
    : 0;
  return {
    combinedNet, shortGain, longGain, lossDeduction, lossUsed, carryST, carryLT,
    taxableIncome, ordinaryTaxable, atZero, atFifteen, atTwenty, magi,
    netInvestmentIncome, niitBase, niit, preferentialTax, shortGainTax,
    totalTax: regularTax + niit,
  };
}

function noTaxIncrease(headroom, baselineTax, netST, netLT, inputs, rules) {
  let lower = 0;
  let upper = headroom;
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (assess(netST, netLT + middle, inputs, rules).totalTax <= baselineTax) {
      lower = middle;
    } else {
      upper = middle - 1;
    }
  }
  return lower;
}

/** Estimate federal tax on ordinary investments. All inputs and outputs use USD. */
export function calculate({
  status = 'single', ordinaryIncome = 0, qualifiedDividends = 0,
  shortGains = 0, shortLosses = 0, longGains = 0, longLosses = 0,
  otherInvestmentIncome = 0, magiAdjustment = 0, deduction,
} = {}) {
  if (!Object.hasOwn(parameters, status)) throw new RangeError('Select a valid filing status.');
  const rules = parameters[status];
  const inputs = {
    ordinaryIncome: cents(ordinaryIncome, 'Ordinary income', true),
    qualifiedDividends: cents(qualifiedDividends, 'Qualified dividends'),
    otherInvestmentIncome: cents(otherInvestmentIncome, 'Other net investment income', true),
    magiAdjustment: cents(magiAdjustment, 'NIIT MAGI adjustment', true),
    deduction: cents(deduction ?? rules.standard, 'Deduction'),
  };
  const netST = cents(shortGains, 'Short-term gains') - cents(shortLosses, 'Short-term losses');
  const netLT = cents(longGains, 'Long-term gains') - cents(longLosses, 'Long-term losses');
  const result = assess(netST, netLT, inputs, rules);

  // At the point where additional LT gains survive netting, all positive ST gains
  // are ordinary income. Unused deductions and any ST loss still absorb LT gains.
  const ordinaryBeforeLT = inputs.ordinaryIncome + positive(netST) - inputs.deduction;
  const capacity = positive(rules.zero * 100 - ordinaryBeforeLT - inputs.qualifiedDividends);
  const zeroHeadroom = positive(capacity + positive(-netST) - netLT);
  const zeroTaxHarvest = noTaxIncrease(zeroHeadroom, result.totalTax, netST, netLT, inputs, rules);
  return {
    ...Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value / 100])),
    netST: netST / 100,
    netLT: netLT / 100,
    deduction: inputs.deduction / 100,
    carryTotal: (result.carryST + result.carryLT) / 100,
    zeroBandRemaining: positive(rules.zero * 100 - result.taxableIncome) / 100,
    zeroHeadroom: zeroHeadroom / 100,
    zeroTaxHarvest: zeroTaxHarvest / 100,
    niit: result.niit / 100000,
    preferentialTax: result.preferentialTax / 100000,
    shortGainTax: result.shortGainTax / 100000,
    totalTax: result.totalTax / 100000,
  };
}
