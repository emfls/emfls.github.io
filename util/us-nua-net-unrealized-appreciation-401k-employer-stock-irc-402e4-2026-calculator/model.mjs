const NIIT = 0.038;
const EARLY_TAX = 0.10;

function checkRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

function leader(gap) {
  if (Math.abs(gap) < 0.005) return 'Tie';
  return gap > 0 ? 'NUA route' : 'Full IRA rollover';
}

// Rates are decimals. Year 0 is an immediate sale; later years are exact anniversaries.
export function compareNua({
  marketValue, costBasis, currentOrdRate, retirementOrdRate, federalLtcgRate,
  stateCapRate, age, years, growth, dividendYield, niitApplies = false,
  ruleOf55 = false, disability = false, trigger = '', fullDistribution = false,
  lots = null,
}) {
  checkRange(marketValue, 0.01, 1e9, 'Stock market value');
  checkRange(costBasis, 0, 1e9, 'Plan cost basis');
  checkRange(age, 0, 120, 'Age at distribution');
  checkRange(years, 0, 20, 'Sale horizon');
  if (!Number.isInteger(years)) throw new RangeError('Enter a whole number of years.');
  checkRange(growth, -1, 1, 'Annual price growth (decimal)');
  checkRange(dividendYield, 0, 0.3, 'Dividend yield (decimal)');
  checkRange(currentOrdRate, 0, 0.8, 'Current ordinary rate (decimal)');
  checkRange(retirementOrdRate, 0, 0.8, 'Later ordinary rate (decimal)');
  checkRange(stateCapRate, 0, 0.3, 'State capital gains rate (decimal)');
  if (![0, 0.15, 0.20].includes(federalLtcgRate)) {
    throw new RangeError('Select a federal long-term capital gains rate.');
  }
  if (ruleOf55 && age < 54) throw new RangeError('Check the age and Rule of 55 inputs.');

  const nuaMarketValue = lots?.marketValue ?? marketValue;
  const nuaCostBasis = lots?.costBasis ?? costBasis;
  checkRange(nuaMarketValue, 0.01, marketValue, 'Selected lots’ market value');
  checkRange(nuaCostBasis, 0, costBasis, 'Selected lots’ cost basis');
  if (nuaMarketValue === marketValue && nuaCostBasis !== costBasis) {
    throw new RangeError('When all shares are selected, the selected basis must equal the total basis.');
  }

  const nuaSpread = Math.max(0, nuaMarketValue - nuaCostBasis);
  const taxableBasis = Math.min(nuaMarketValue, nuaCostBasis);
  const iraRemainder = marketValue - nuaMarketValue;
  const death = trigger === 'death';
  const selfEmployedDisability = trigger === 'self-employed-disability';
  const earlyTaxException = disability || selfEmployedDisability || death;
  const earlyNuaRate = age < 59.5 && !ruleOf55 && !earlyTaxException ? EARLY_TAX : 0;
  const upfrontIncomeTax = taxableBasis * currentOrdRate;
  const upfrontPenalty = taxableBasis * earlyNuaRate;
  const upfrontTax = upfrontIncomeTax + upfrontPenalty;
  const ltcgRate = federalLtcgRate + stateCapRate;
  const niitRate = niitApplies ? NIIT : 0;
  const qualifiedTrigger = trigger === 'separation' || death
    || (trigger === 'age' && age >= 59.5)
    || selfEmployedDisability;

  let stockValue = nuaMarketValue;
  let afterTaxDividends = 0;
  const projections = [];
  for (let year = 0; year <= 20; year++) {
    if (year > 0) {
      afterTaxDividends += stockValue * dividendYield * (1 - ltcgRate - niitRate);
      stockValue *= 1 + growth;
    }
    const ordinaryRate = year === 0 ? currentOrdRate : retirementOrdRate;
    const iraPenaltyRate = age + year < 59.5 && !earlyTaxException ? EARLY_TAX : 0;
    const iraNetFactor = 1 - ordinaryRate - iraPenaltyRate;
    const iraGrowth = (1 + growth + dividendYield) ** year;
    const realizedNua = Math.min(nuaSpread, Math.max(0, stockValue - taxableBasis));
    const postDistributionGain = Math.max(0, stockValue - nuaMarketValue);
    const postGainRate = year <= 1 ? ordinaryRate : ltcgRate;
    const nuaSaleTax = realizedNua * ltcgRate;
    const postGainTax = postDistributionGain * (postGainRate + niitRate);
    const nuaNet = stockValue + afterTaxDividends - upfrontTax - nuaSaleTax - postGainTax
      + iraRemainder * iraGrowth * iraNetFactor;
    const iraNet = marketValue * iraGrowth * iraNetFactor;
    const gap = nuaNet - iraNet;
    projections.push({
      year, stockValue, afterTaxDividends, realizedNua, postDistributionGain,
      nuaSaleTax, postGainTax, iraPenaltyRate, nuaNet, iraNet, gap,
      niitAvoided: realizedNua * niitRate, winner: leader(gap),
    });
  }

  return {
    qualified: qualifiedTrigger && fullDistribution,
    costBasisRatio: nuaCostBasis / nuaMarketValue,
    nuaCostBasis, taxableBasis, nuaSpread, iraRemainder,
    upfrontIncomeTax, upfrontPenalty, upfrontTax,
    immediate: projections[0],
    horizon: projections[years],
    projections,
  };
}
