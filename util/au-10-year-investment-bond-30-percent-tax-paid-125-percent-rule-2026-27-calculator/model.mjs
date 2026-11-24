export const BOND_TAX_CAP = 0.30;
export const WITHDRAWAL_OFFSET = 0.30;
export const CGT_DISCOUNT = 0.50;
const MAX_CONTRIBUTION = 100_000_000;

function bounded(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} is out of range.`);
  }
}

function contributionCents(amount) {
  bounded(amount, 0, MAX_CONTRIBUTION, 'Contribution');
  const cents = Math.round(amount * 100);
  if (cents / 100 !== amount) {
    throw new RangeError('Enter contributions to the nearest cent.');
  }
  return cents;
}

export function checkContribution(priorYearContribution, plannedThisYearContribution) {
  const priorCents = contributionCents(priorYearContribution);
  const plannedCents = contributionCents(plannedThisYearContribution);
  // Round down because the input accepts whole cents and exceeding the exact limit resets the clock.
  const safeCents = Math.floor(priorCents * 5 / 4);
  return {
    maxSafeContribution: safeCents / 100,
    resets: plannedCents > safeCents,
    remainingHeadroom: Math.max(0, safeCents - plannedCents) / 100,
    excessContribution: Math.max(0, plannedCents - safeCents) / 100,
  };
}

export function withdrawalTax(bonus, policyYear, marginalRate) {
  if (!Number.isFinite(bonus) || !Number.isInteger(policyYear) || policyYear < 1) {
    throw new RangeError('Enter a finite bonus and a positive whole policy year.');
  }
  bounded(marginalRate, 0, 1, 'Marginal rate');

  const fractions = { 9: 2 / 3, 10: 1 / 3 };
  const assessableFraction = policyYear <= 8 ? 1 : (fractions[policyYear] ?? 0);
  const assessableBonus = Math.max(0, bonus) * assessableFraction;
  return {
    assessableFraction,
    assessableBonus,
    offset: assessableBonus * WITHDRAWAL_OFFSET,
    topUpTax: assessableBonus * Math.max(0, marginalRate - WITHDRAWAL_OFFSET),
  };
}

export function calculateBond({
  initialInvestment, annualContribution, incomeYield, capitalGrowth,
  bondRate, marginalRate, directFrankingRate = 0, years,
}) {
  const initialCents = contributionCents(initialInvestment);
  const annualCents = contributionCents(annualContribution);
  bounded(incomeYield, 0, 1, 'Income yield');
  bounded(capitalGrowth, -1, 1, 'Capital growth');
  bounded(bondRate, 0, BOND_TAX_CAP, 'Effective bond tax rate');
  bounded(directFrankingRate, 0, 1, 'Direct franking credit rate');
  if (![0.32, 0.39, 0.47].includes(marginalRate) || !Number.isInteger(years) || years < 1 || years > 20) {
    throw new RangeError('Select a listed marginal rate and a whole holding period from 1 to 20 years.');
  }

  let bondBalance = 0;
  let directBalance = 0;
  let directDiscountEligibleGain = 0;
  let directShortTermGain = 0;
  let lastReinvestment = 0;
  let clockStart = null;
  let lastResetYear = null;
  let priorContribution = 0;

  for (let year = 1; year <= years; year++) {
    const deposit = (year === 1 ? initialCents : annualCents) / 100;
    if (clockStart === null) {
      if (deposit > 0) clockStart = year;
    } else if (checkContribution(priorContribution, deposit).resets) {
      clockStart = lastResetYear = year;
    }
    priorContribution = deposit;

    bondBalance += deposit;
    const taxableBondReturn = incomeYield + Math.max(0, capitalGrowth);
    bondBalance *= 1 + (incomeYield + capitalGrowth) - taxableBondReturn * bondRate;

    directBalance += deposit;
    // Sale is just before the next anniversary. The latest deposit and prior year's
    // reinvested distribution have been held for just under 12 months.
    const youngCapital = Math.min(directBalance, deposit + lastReinvestment);
    directShortTermGain = youngCapital * capitalGrowth;
    const capitalGain = directBalance * capitalGrowth;
    // All gains from an earlier year qualify by the time of the sale.
    directDiscountEligibleGain += year < years ? capitalGain : capitalGain - directShortTermGain;
    lastReinvestment = directBalance * incomeYield * (1 + directFrankingRate) * (1 - marginalRate);
    directBalance = directBalance * (1 + capitalGrowth) + lastReinvestment;
  }

  const totalContributions = (initialCents + annualCents * (years - 1)) / 100;
  const policyYear = clockStart === null ? null : years - clockStart + 1;
  const bondBonus = Math.max(0, bondBalance - totalContributions);
  const bondExitTax = policyYear === null ? 0 : withdrawalTax(bondBonus, policyYear, marginalRate).topUpTax;
  const bondAfterTax = bondBalance - bondExitTax;
  const directCgt = Math.max(0, directShortTermGain + directDiscountEligibleGain * (1 - CGT_DISCOUNT)) * marginalRate;
  const directAfterTax = directBalance - directCgt;
  const difference = bondAfterTax - directAfterTax;
  const winner = Math.abs(difference) < 0.005 ? 'tie' : difference > 0 ? 'bond' : 'direct';

  return {
    totalContributions, policyYear, lastResetYear, bondBonus, bondExitTax,
    bondBeforeExitTax: bondBalance, bondAfterTax, directBeforeCgt: directBalance,
    directDiscountEligibleGain, directShortTermGain, directCgt, directAfterTax, difference, winner,
  };
}
