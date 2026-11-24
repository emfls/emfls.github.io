export const FILING_RULES = Object.freeze({
  single: Object.freeze({ zero: 49450, fifteen: 545500, exclusion: 250000, niit: 200000 }),
  mfj: Object.freeze({ zero: 98900, fifteen: 613700, exclusion: 500000, niit: 250000 }),
  hoh: Object.freeze({ zero: 66200, fifteen: 579600, exclusion: 250000, niit: 200000 }),
  mfs: Object.freeze({ zero: 49450, fifteen: 306850, exclusion: 250000, niit: 125000 })
});

export const MAX_DOLLARS = 1_000_000_000;

function filingRules(status) {
  if (!Object.hasOwn(FILING_RULES, status)) throw new RangeError('Choose a filing status.');
  return FILING_RULES[status];
}

const toCents = value => Math.round(value * 100);

function validNumber(value, label, max = MAX_DOLLARS, min = 0) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid value for ${label}.`);
  }
  return value;
}

function longTermGainTax(gain, ordinaryIncome, rules) {
  const zeroRoom = Math.max(0, toCents(rules.zero) - ordinaryIncome);
  const fifteenRoom = Math.max(0, toCents(rules.fifteen) - ordinaryIncome);
  const atFifteen = Math.max(0, Math.min(gain, fifteenRoom) - zeroRoom);
  const atTwenty = Math.max(0, gain - fifteenRoom);
  return Math.round((atFifteen * 15 + atTwenty * 20) / 100);
}

export function calculateLongTermGainTax(gain, ordinaryTaxableIncome, filingStatus) {
  const rules = filingRules(filingStatus);
  return longTermGainTax(
    toCents(validNumber(gain, 'long-term gain')),
    toCents(validNumber(ordinaryTaxableIncome, 'ordinary taxable income')),
    rules
  ) / 100;
}

function estimateTaxes(taxableLTCG, unrecaptured1250, ordinaryIncome, ordinaryRate, preSaleMAGI, stateRate, rules) {
  const taxableSaleGain = taxableLTCG + unrecaptured1250;
  const totalMAGI = preSaleMAGI + taxableSaleGain;
  const niitBase = Math.min(taxableSaleGain, Math.max(0, totalMAGI - toCents(rules.niit)));
  const ltcgTax = longTermGainTax(taxableLTCG, ordinaryIncome, rules);
  const depreciationTax = Math.round(unrecaptured1250 * Math.min(toCents(ordinaryRate), 2500) / 10000);
  const niit = Math.round(niitBase * 38 / 1000);
  const stateTax = Math.round(taxableSaleGain * toCents(stateRate) / 10000);
  return {
    taxableSaleGain, totalMAGI, niitBase, ltcgTax, depreciationTax, niit, stateTax,
    totalTax: ltcgTax + depreciationTax + niit + stateTax
  };
}

// Dollar inputs and outputs. Rates are percentages, e.g. 24 represents 24%.
export function calculateHomeSale({
  filingStatus, eligibility, monthsLived = 0, salePrice, sellingCosts = 0, purchasePrice,
  purchaseClosingCosts = 0, capitalImprovements = 0, priorDepreciationClaimed = 0,
  ordinaryTaxableIncome, ordinaryMarginalRate, preSaleMAGI, stateTaxRate = 0, mortgagePayoff = 0
}) {
  const rules = filingRules(filingStatus);
  const dollars = (value, label) => toCents(validNumber(value, label));
  const ordinaryIncome = dollars(ordinaryTaxableIncome, 'ordinary taxable income');
  const ordinaryRate = validNumber(ordinaryMarginalRate, 'ordinary marginal tax rate', 100);
  const modifiedIncome = toCents(validNumber(preSaleMAGI, 'pre-sale MAGI', MAX_DOLLARS, -MAX_DOLLARS));
  const stateRate = validNumber(stateTaxRate, 'state tax rate', 100);
  const payoff = dollars(mortgagePayoff, 'mortgage payoff');

  const basisBeforeDepreciation = dollars(purchasePrice, 'purchase price') +
    dollars(purchaseClosingCosts, 'purchase closing costs') +
    dollars(capitalImprovements, 'capital improvements');
  const depreciation = dollars(priorDepreciationClaimed, 'prior depreciation');
  if (depreciation > basisBeforeDepreciation) {
    throw new RangeError('Prior depreciation cannot exceed the basis before depreciation.');
  }

  const adjustedBasis = basisBeforeDepreciation - depreciation;
  const amountRealized = dollars(salePrice, 'sale price') - dollars(sellingCosts, 'selling costs');
  const realizedGainOrLoss = amountRealized - adjustedBasis;
  const totalRealizedGain = Math.max(0, realizedGainOrLoss);
  const unrecaptured1250 = Math.min(totalRealizedGain, depreciation);
  const nonDepGain = totalRealizedGain - unrecaptured1250;

  let exclusionLimit;
  switch (eligibility) {
    case 'full':
      exclusionLimit = toCents(rules.exclusion);
      break;
    case 'partial':
      exclusionLimit = Math.round(toCents(rules.exclusion) *
        Math.min(24, validNumber(monthsLived, 'qualifying months', 60)) / 24);
      break;
    case 'none':
      exclusionLimit = 0;
      break;
    default:
      throw new RangeError('Choose a Section 121 eligibility option.');
  }

  const sec121Exclusion = Math.min(nonDepGain, exclusionLimit);
  const taxableLTCG = nonDepGain - sec121Exclusion;
  const withExclusion = estimateTaxes(taxableLTCG, unrecaptured1250, ordinaryIncome, ordinaryRate, modifiedIncome, stateRate, rules);
  const withoutExclusion = estimateTaxes(nonDepGain, unrecaptured1250, ordinaryIncome, ordinaryRate, modifiedIncome, stateRate, rules);
  const netCashAtClosing = amountRealized - payoff;

  const cents = {
    adjustedBasis, amountRealized, realizedGainOrLoss, totalRealizedGain, unrecaptured1250,
    nonDepGain, exclusionLimit, sec121Exclusion, taxableLTCG, ...withExclusion,
    netCashAtClosing, afterTaxProceeds: netCashAtClosing - withExclusion.totalTax,
    taxWithoutExclusion: withoutExclusion.totalTax,
    section121TaxSaved: withoutExclusion.totalTax - withExclusion.totalTax
  };
  return Object.fromEntries(Object.entries(cents).map(([key, amount]) => [key, amount / 100]));
}
