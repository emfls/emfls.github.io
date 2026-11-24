const BASE_LIMIT = 7500;
const CATCH_UP = 1100;
const PROJECTION_YEARS = 20;
const MAX_DOLLARS = 1_000_000_000;

const singleRange = [153000, 168000];
const jointRange = [242000, 252000];
const phaseOuts = new Map([
  ['single', singleRange],
  ['hoh', singleRange],
  ['mfj', jointRange],
  ['qss', jointRange],
  ['mfs-together', [0, 10000]],
  ['mfs-apart', singleRange]
]);

function cents(value, label, min = 0, max = MAX_DOLLARS) {
  const scaled = Math.round(value * 100);
  if (!Number.isFinite(value) || value < min || value > max || scaled / 100 !== value) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}, with up to two decimal places.`);
  }
  return scaled;
}

export function contributionLimit(age) {
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw new RangeError('Enter a whole-number year-end age from 0 to 120.');
  }
  return BASE_LIMIT + (age >= 50 ? CATCH_UP : 0);
}

export function rothEligibility({ age, filing, magi, compensation, otherContributions = 0, contribution }) {
  const range = phaseOuts.get(filing);
  if (!range) throw new RangeError('Choose a filing status.');
  const [lower, upper] = range.map(value => value * 100);
  const income = cents(magi, 'Roth IRA MAGI', -MAX_DOLLARS);
  const annualLimit = contributionLimit(age);
  const cap = Math.min(annualLimit * 100, cents(compensation, 'IRA-eligible compensation'));
  const other = cents(otherContributions, 'Other traditional IRA contributions');
  const planned = cents(contribution, 'New nondeductible contribution');
  if (other > cap) throw new RangeError('Other traditional IRA contributions exceed your shared IRA limit.');
  const room = cap - other;
  if (planned > room) throw new RangeError('The new nondeductible contribution exceeds your remaining IRA contribution room.');

  let phaseLimit = cap;
  if (income >= upper) {
    phaseLimit = 0;
  } else if (income > lower) {
    // Keep the full fraction through the worksheet's round-up to $10.
    const roundedUp = Math.ceil(cap * (upper - income) / ((upper - lower) * 1000)) * 1000;
    phaseLimit = Math.max(20000, roundedUp);
  }
  const direct = Math.min(room, phaseLimit);
  return {
    annualLimit,
    remainingRoom: room / 100,
    directLimit: direct / 100,
    backdoorAmount: Math.max(0, planned - direct) / 100
  };
}

export function proRata({ priorBasis, contribution, preTax, conversion, federalRate, stateRate = 0 }) {
  const basis = cents(priorBasis, 'Prior IRA basis') + cents(contribution, 'New nondeductible contribution', 0, BASE_LIMIT + CATCH_UP);
  const pool = cents(preTax, 'Pre-tax IRA pool') + basis;
  const converted = cents(conversion, 'Planned conversion');
  const rate = cents(federalRate, 'Federal tax rate', 0, 100) + cents(stateRate, 'State tax rate', 0, 100);
  if (rate > 10000) throw new RangeError('The combined tax rate cannot exceed 100%.');
  if (converted > pool) throw new RangeError('The conversion cannot exceed the available IRA pool.');

  const nontaxableRatio = pool ? Number((basis / pool).toFixed(12)) : 0;
  // Calculate from the exact fraction so rounding the displayed ratio cannot move a cent.
  const exempt = pool ? Number((BigInt(converted) * BigInt(basis) + BigInt(pool) / 2n) / BigInt(pool)) : 0;
  const taxable = converted - exempt;
  return {
    totalBasis: basis / 100,
    totalAggregatedIRA: pool / 100,
    yearEndBalance: (pool - converted) / 100,
    nontaxableRatio,
    nontaxableConverted: exempt / 100,
    taxableConverted: taxable / 100,
    surpriseProRataTax: Math.round(taxable * rate / 10000) / 100,
    remainingBasisCarryForward: (basis - exempt) / 100
  };
}

export function compareGrowth({ principal, annualReturn, gainsRate }) {
  const starting = cents(principal, 'Investment principal');
  const rate = cents(annualReturn, 'Annual return', -100, 100) / 10000;
  const gainsTaxRate = cents(gainsRate, 'Capital gains tax rate', 0, 100) / 10000;
  const ending = starting * (1 + rate) ** PROJECTION_YEARS;
  const roth = Math.round(ending);
  const brokerage = Math.round(ending - Math.max(0, ending - starting) * gainsTaxRate);
  return { roth: roth / 100, brokerage: brokerage / 100, rothAdvantage: (roth - brokerage) / 100 };
}

export function estimate(inputs) {
  const eligibility = rothEligibility(inputs);
  const current = proRata(inputs);
  const conversion = Math.min(inputs.conversion, current.totalBasis);
  const clean = proRata({ ...inputs, preTax: 0, conversion });
  const rollover = {
    conversion,
    conversionReduction: Math.round((inputs.conversion - conversion) * 100) / 100,
    conversionTax: clean.surpriseProRataTax,
    taxSavings: current.surpriseProRataTax - clean.surpriseProRataTax
  };
  return { eligibility, current, rollover, growth: compareGrowth({ ...inputs, principal: conversion }) };
}
