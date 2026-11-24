export const DEFAULT_CLOSING_FEES = 1200;

export function calculateMortgageBreak({
  balance, mortgageType, contractRate, originalPostedRate, currentPostedRemTerm,
  currentMarketRemTerm, remainingMonths, prepaymentPercent = 0, newRefinanceRate,
  closingFees = DEFAULT_CLOSING_FEES,
}) {
  const fixed = mortgageType === 'fixed_closed';
  if (!fixed && mortgageType !== 'variable_closed') throw new RangeError('Choose a closed mortgage type.');
  const rates = fixed
    ? [contractRate, newRefinanceRate, originalPostedRate, currentPostedRemTerm, currentMarketRemTerm]
    : [contractRate, newRefinanceRate];
  if (
    !Number.isFinite(balance) || balance < 0.01 || balance > 1e9 ||
    rates.some(rate => !Number.isFinite(rate) || rate < 0 || rate > 100) ||
    !Number.isInteger(remainingMonths) || remainingMonths < 1 || remainingMonths > 59 ||
    !Number.isFinite(prepaymentPercent) || prepaymentPercent < 0 || prepaymentPercent > 20 ||
    !Number.isFinite(closingFees) || closingFees < 0 || closingFees > 1e9
  ) {
    throw new RangeError('Enter a positive balance, rates from 0–100%, 1–59 whole months, and a lump sum from 0–20%.');
  }

  const years = remainingMonths / 12;
  const threeMonthsInterest = balance * (contractRate / 100) * (3 / 12);
  const originalDiscount = fixed ? Math.max(0, originalPostedRate - contractRate) : null;
  const bankComparisonRate = fixed ? Math.max(0, currentPostedRemTerm - originalDiscount) : null;
  const bankIrdSpread = fixed ? Math.max(0, contractRate - bankComparisonRate) : 0;
  const monolineSpread = fixed ? Math.max(0, contractRate - currentMarketRemTerm) : 0;
  const bankIrdPenalty = balance * (bankIrdSpread / 100) * years;
  const monolineIrdPenalty = balance * (monolineSpread / 100) * years;
  const big6FinalPenalty = Math.max(threeMonthsInterest, bankIrdPenalty);
  const monolineFinalPenalty = Math.max(threeMonthsInterest, monolineIrdPenalty);
  const extraCost = big6FinalPenalty - monolineFinalPenalty;
  const penaltyMultiple = monolineFinalPenalty > 0 ? big6FinalPenalty / monolineFinalPenalty : null;
  const lumpSum = balance * (prepaymentPercent / 100);
  const reducedBalance = balance - lumpSum;

  // Compare switching with waiting on the same balance to isolate the value of refinancing.
  function refinance(principal, penalty) {
    const monthlySavings = principal * ((contractRate - newRefinanceRate) / 100) / 12;
    const interestSaved = monthlySavings * remainingMonths;
    const switchingCost = penalty + closingFees;
    const net = interestSaved - switchingCost;
    const breakEvenRate = contractRate - switchingCost / (principal * years) * 100;
    const breakEvenMonths = monthlySavings > 0 ? switchingCost / monthlySavings : null;
    const verdict = Math.abs(net) < 0.005 ? 'break_even' : net > 0 ? 'refinance' : 'wait';
    return { penalty, interestSaved, switchingCost, net, breakEvenRate, breakEvenMonths, verdict };
  }

  const bankPenaltySavings = big6FinalPenalty * (prepaymentPercent / 100);
  const monolinePenaltySavings = monolineFinalPenalty * (prepaymentPercent / 100);
  return {
    threeMonthsInterest, originalDiscount, bankComparisonRate, bankIrdSpread, monolineSpread,
    bankIrdPenalty, monolineIrdPenalty, big6FinalPenalty, monolineFinalPenalty,
    extraCost, penaltyMultiple, lumpSum, reducedBalance, closingFees,
    bankPenaltySavings, monolinePenaltySavings,
    bank: refinance(balance, big6FinalPenalty),
    bankAfterPrepayment: refinance(reducedBalance, big6FinalPenalty - bankPenaltySavings),
    monoline: refinance(balance, monolineFinalPenalty),
    monolineAfterPrepayment: refinance(reducedBalance, monolineFinalPenalty - monolinePenaltySavings),
  };
}
