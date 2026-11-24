const ordinaryRates = [.10, .12, .22, .24, .32, .35, .37];
const recoveryYears = Object.freeze({ residential_27_5yr: 27.5, commercial_39yr: 39 });
const maxDollars = 1e12;

export const parameters = Object.freeze({
  single: Object.freeze({
    ordinaryCeilings: Object.freeze([12400, 50400, 105700, 201775, 256225, 640600]),
    ltcgZeroCeiling: 49450, ltcgFifteenCeiling: 545500,
    niitThreshold: 200000, standardDeduction: 16100,
  }),
  mfj: Object.freeze({
    ordinaryCeilings: Object.freeze([24800, 100800, 211400, 403550, 512450, 768700]),
    ltcgZeroCeiling: 98900, ltcgFifteenCeiling: 613700,
    niitThreshold: 250000, standardDeduction: 32200,
  }),
});

export const defaults = Object.freeze({
  propertyType: 'residential_27_5yr',
  originalPurchasePrice: 500000,
  landPercent: 20,
  yearsHeld: 10,
  capitalImprovements: 50000,
  sec1245Depreciation: 35000,
  grossSalePrice: 750000,
  sellingCostPercent: 6,
  filingStatus: 'single',
  otherTaxableIncome: 150000,
  stateTaxPercent: 5,
  mortgagePayoff: 245000,
  sec1245Basis: null,
  sec1245NetProceeds: null,
  sec1250DepreciationOverride: null,
  preSaleMagi: null,
  otherNetInvestmentIncome: 0,
  saleSubjectToNiit: true,
});

function amount(value, label, min = 0, max = maxDollars) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
  }
  return value;
}

function ordinaryTaxBetween(bottom, top, ceilings) {
  return ordinaryRates.reduce((tax, rate, index) => {
    const start = Math.max(bottom, ceilings[index - 1] ?? 0);
    const end = Math.min(top, ceilings[index] ?? Infinity);
    return tax + Math.max(0, end - start) * rate;
  }, 0);
}

// Schedule D Tax Worksheet stack for a return with ordinary income, §1250 gain
// and regular long-term gain. Other preferential income and losses are excluded.
function capitalTaxes(ordinaryTop, sec1250Gain, ltcg, brackets) {
  const capitalStack = ordinaryTop + sec1250Gain;
  const ordinary1250 = Math.min(sec1250Gain, Math.max(0, brackets.ordinaryCeilings[3] - ordinaryTop));
  const ordinary1250Top = ordinaryTop + ordinary1250;
  const sec1250Tax = ordinaryTaxBetween(ordinaryTop, ordinary1250Top, brackets.ordinaryCeilings)
    + (sec1250Gain - ordinary1250) * .25;

  const ltcgAtZero = Math.min(ltcg, Math.max(0, brackets.ltcgZeroCeiling - capitalStack));
  const ltcgAtFifteen = Math.min(ltcg - ltcgAtZero,
    Math.max(0, brackets.ltcgFifteenCeiling - ordinary1250Top - ltcgAtZero));
  const ltcgAtTwenty = ltcg - ltcgAtZero - ltcgAtFifteen;
  const ltcgTax = ltcgAtFifteen * .15 + ltcgAtTwenty * .20;
  return { sec1250Tax, ltcgAtZero, ltcgAtFifteen, ltcgAtTwenty, ltcgTax };
}

export function calculate(inputs = {}) {
  const config = { ...defaults, ...inputs };
  const life = Object.hasOwn(recoveryYears, config.propertyType) && recoveryYears[config.propertyType];
  const brackets = Object.hasOwn(parameters, config.filingStatus) && parameters[config.filingStatus];
  if (!life || !brackets) throw new RangeError('Choose a supported property type and filing status.');

  const purchase = amount(config.originalPurchasePrice, 'Purchase price', 1);
  const landBasis = purchase * (amount(config.landPercent, 'Land allocation', 0, 100) / 100);
  const improvements = amount(config.capitalImprovements, 'Capital improvements');
  const years = amount(config.yearsHeld, 'Years held', 1, 40);
  const sec1245Depreciation = amount(config.sec1245Depreciation, 'Section 1245 depreciation');
  const sec1245Basis = amount(config.sec1245Basis ?? sec1245Depreciation, 'Section 1245 original basis');
  if (sec1245Depreciation > sec1245Basis) {
    throw new RangeError('Section 1245 depreciation exceeds the Section 1245 original basis.');
  }
  const depreciableBasis = purchase - landBasis + improvements;
  if (sec1245Basis > depreciableBasis) {
    throw new RangeError('Section 1245 original basis exceeds the total depreciable basis.');
  }
  const buildingBasis = depreciableBasis - sec1245Basis;
  const sec1250Depreciation = amount(
    config.sec1250DepreciationOverride ?? buildingBasis * (Math.min(years, life) / life),
    'Section 1250 depreciation (limited to building basis)', 0, buildingBasis,
  );
  const totalDepreciation = sec1245Depreciation + sec1250Depreciation;
  const adjustedBasis = Math.max(landBasis, purchase + improvements - totalDepreciation);

  const salePrice = amount(config.grossSalePrice, 'Gross sale price');
  const sellingCosts = salePrice * (amount(config.sellingCostPercent, 'Selling costs', 0, 100) / 100);
  const netSaleProceeds = salePrice - sellingCosts;
  const realizedGainOrLoss = netSaleProceeds - adjustedBasis;
  const totalRealizedGain = Math.max(0, realizedGainOrLoss);
  const aggregateAllocation = config.sec1245NetProceeds == null;
  const gainOn1245Assets = aggregateAllocation ? sec1245Depreciation : Math.max(0,
    amount(config.sec1245NetProceeds, 'Section 1245 proceeds (limited to net sale proceeds)', 0, netSaleProceeds)
      - (sec1245Basis - sec1245Depreciation));
  const sec1245Gain = Math.min(totalRealizedGain, gainOn1245Assets, sec1245Depreciation);
  const remainingGain = totalRealizedGain - sec1245Gain;
  const ltcg1245 = Math.min(remainingGain, Math.max(0, gainOn1245Assets - sec1245Gain));
  const buildingRecapture = Math.min(remainingGain - ltcg1245, sec1250Depreciation);
  const sec1250Gain = years > 1 ? buildingRecapture : 0;
  const sec1250OrdinaryGain = buildingRecapture - sec1250Gain;
  const appreciation = remainingGain - buildingRecapture;
  const remainingLtcg = years > 1 ? appreciation : 0;
  const remainingOrdinaryGain = appreciation - remainingLtcg;

  const ordinary = amount(config.otherTaxableIncome, 'Other taxable income');
  const sec1245Top = ordinary + sec1245Gain;
  const sec1250OrdinaryTop = sec1245Top + sec1250OrdinaryGain;
  const ordinaryTop = sec1250OrdinaryTop + remainingOrdinaryGain;
  const sec1245Tax = ordinaryTaxBetween(ordinary, sec1245Top, brackets.ordinaryCeilings);
  const sec1250OrdinaryTax = ordinaryTaxBetween(sec1245Top, sec1250OrdinaryTop, brackets.ordinaryCeilings);
  const remainingOrdinaryTax = ordinaryTaxBetween(sec1250OrdinaryTop, ordinaryTop, brackets.ordinaryCeilings);
  const capital = capitalTaxes(ordinaryTop, sec1250Gain, remainingLtcg, brackets);

  const magiWasEstimated = config.preSaleMagi == null;
  const magi = magiWasEstimated
    ? ordinary + brackets.standardDeduction
    : amount(config.preSaleMagi, 'Pre-sale MAGI');
  const otherNii = amount(config.otherNetInvestmentIncome, 'Other net investment income', -maxDollars);
  const niitBefore = .038 * Math.max(0, Math.min(otherNii, magi - brackets.niitThreshold));
  const niitOnGain = (gain) => {
    const investmentIncome = otherNii + (config.saleSubjectToNiit ? gain : 0);
    const excessMagi = magi + gain - brackets.niitThreshold;
    return .038 * Math.max(0, Math.min(investmentIncome, excessMagi)) - niitBefore;
  };
  const niit = niitOnGain(totalRealizedGain);
  const stateRate = amount(config.stateTaxPercent, 'State tax rate', 0, 100) / 100;
  const stateTax = totalRealizedGain * stateRate;
  const federalTax = sec1245Tax + capital.sec1250Tax + sec1250OrdinaryTax
    + capital.ltcgTax + remainingOrdinaryTax + niit;
  const totalTax = federalTax + stateTax;
  const mortgagePayoff = amount(config.mortgagePayoff, 'Mortgage payoff');
  const walkAwayCash = netSaleProceeds - mortgagePayoff - totalTax;

  // Illustrative no-boot exchange: real estate qualifies, §1245 assets remain taxable.
  const exchangeGainNow = sec1245Gain + ltcg1245;
  const exchangeAppreciationTax = years > 1
    ? capitalTaxes(sec1245Top, 0, ltcg1245, brackets).ltcgTax
    : ordinaryTaxBetween(sec1245Top, sec1245Top + ltcg1245, brackets.ordinaryCeilings);
  const exchangeTaxNow = sec1245Tax + exchangeAppreciationTax
    + niitOnGain(exchangeGainNow) + exchangeGainNow * stateRate;
  const exchangeTaxDeferred = Math.max(0, totalTax - exchangeTaxNow);

  return {
    landBasis, buildingBasis, life, sec1250Depreciation, totalDepreciation, adjustedBasis,
    sellingCosts, netSaleProceeds, realizedGainOrLoss, totalRealizedGain,
    sec1245Gain, sec1250Gain, sec1250OrdinaryGain, remainingLtcg, remainingOrdinaryGain,
    sec1245Tax, sec1250OrdinaryTax, remainingOrdinaryTax, ...capital,
    magi, magiWasEstimated, aggregateAllocation, niit, stateTax, federalTax, totalTax, walkAwayCash,
    exchangeGainNow, exchangeTaxNow, exchangeTaxDeferred, identificationDays: 45, exchangeDays: 180,
  };
}
