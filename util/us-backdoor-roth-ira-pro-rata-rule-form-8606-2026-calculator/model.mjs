const limits = new Map([['under_50', 7500], ['50_plus', 8600]]);
const federalRates = [22, 24, 32, 35, 37];
const maxAmount = 1_000_000_000;

export function contributionLimit(ageBand) {
  if (!limits.has(ageBand)) throw new RangeError('Select a valid age band.');
  return limits.get(ageBand);
}

function checkAmount(value, label, max = maxAmount) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-US')}.`);
  }
}

function splitConversion(totalBasis, yearEndBalance, conversion, combinedRate) {
  const totalDec31Pool = yearEndBalance + conversion;
  const nontaxableRatio = totalDec31Pool > 0 ? Math.min(1, totalBasis / totalDec31Pool) : 1;
  const nontaxableConversion = Math.min(totalBasis, conversion * nontaxableRatio);
  const taxableConversion = conversion - nontaxableConversion;
  const remainingBasisCarryover = totalBasis - nontaxableConversion;
  const lines = { 14: remainingBasisCarryover };

  if (conversion > 0) {
    Object.assign(lines, {
      6: yearEndBalance,
      7: 0,
      8: conversion,
      9: totalDec31Pool,
      10: nontaxableRatio,
      11: nontaxableConversion,
      12: 0,
      13: nontaxableConversion,
      '15a': 0,
      '15b': 0,
      '15c': 0,
      16: conversion,
      17: nontaxableConversion,
      18: taxableConversion,
    });
  }

  return {
    yearEndBalance,
    totalDec31Pool,
    nontaxableRatio,
    nontaxableConversion,
    taxableConversion,
    remainingBasisCarryover,
    proRataTaxBill: taxableConversion * combinedRate / 100,
    lines,
  };
}

export function calculateBackdoorRoth({
  ageBand, contribution, priorBasis, yearEndBalance, conversion, federalRate, stateRate,
}) {
  checkAmount(contribution, '2026 nondeductible contribution', contributionLimit(ageBand));
  checkAmount(priorBasis, 'Prior IRA basis');
  checkAmount(yearEndBalance, 'Year-end IRA balance');
  checkAmount(conversion, 'Conversion amount');
  if (!federalRates.includes(federalRate)) throw new RangeError('Select a supported federal marginal rate.');
  checkAmount(stateRate, 'State tax rate (%)', 100);

  const totalBasis = priorBasis + contribution;
  const combinedRate = federalRate + stateRate;
  const withoutRollover = splitConversion(totalBasis, yearEndBalance, conversion, combinedRate);

  // Preserve any basis beyond the conversion amount, limited to assets available
  // in the IRA. The remainder represents the maximum modeled pre-tax transfer.
  const rolloverBalance = Math.min(yearEndBalance, Math.max(0, totalBasis - conversion));
  const rolloverAmount = yearEndBalance - rolloverBalance;
  const withRollover = splitConversion(totalBasis, rolloverBalance, conversion, combinedRate);

  return {
    totalBasis,
    rolloverAmount,
    withoutRollover,
    withRollover,
    taxSavings: withoutRollover.proRataTaxBill - withRollover.proRataTaxBill,
  };
}
