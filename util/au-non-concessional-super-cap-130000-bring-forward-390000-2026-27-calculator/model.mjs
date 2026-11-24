export const PARAMETERS = Object.freeze({
  concessionalCap: 32_500,
  annualCap: 130_000,
  generalTbc: 2_100_000,
  threeYearThreshold: 1_840_000,
  twoYearThreshold: 1_970_000,
  keepTaxRate: 47,
  releasedEarningsPercent: 85,
  earningsOffsetPercent: 15,
});

function toCents(amount, label) {
  // Convert before subtraction so a one-cent excess stays exactly one cent.
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || amount < 0 || cents / 100 !== amount) {
    throw new RangeError(label + ' must be a non-negative amount with up to two decimal places.');
  }
  return cents;
}

/**
 * Amounts are in AUD. plannedContribution is the full financial-year NCC total.
 * A null prior balance means no active arrangement; zero means active and used up.
 * marginalRate is a percentage including any applicable Medicare levy.
 * Null earnings or rate represent fields for which no estimate was entered.
 */
export function calculateSuperCap({
  tsb,
  under75DuringYear,
  remainingPriorBringForwardCap = null,
  plannedContribution,
  associatedEarnings = null,
  marginalRate = null,
}) {
  const balance = toCents(tsb, 'Total super balance') / 100;
  const contribution = toCents(plannedContribution, 'Financial-year contributions');
  const earnings = associatedEarnings === null ? null : toCents(associatedEarnings, 'Associated earnings');
  const priorCap = remainingPriorBringForwardCap === null
    ? null : toCents(remainingPriorBringForwardCap, 'Prior bring-forward balance') / 100;
  if (typeof under75DuringYear !== 'boolean') {
    throw new RangeError('Choose an age eligibility option.');
  }
  const rate = marginalRate === null ? null : toCents(marginalRate, 'Marginal rate') / 100;
  if (rate > 100) {
    throw new RangeError('Marginal rate must be between 0% and 100%.');
  }

  const { annualCap, generalTbc, threeYearThreshold, twoYearThreshold } = PARAMETERS;
  let capYears = 1;
  let capBasis = 'annual';
  let maxAllowedCap = annualCap;
  if (balance >= generalTbc) {
    capYears = 0;
    capBasis = 'nil';
    maxAllowedCap = 0;
  } else if (priorCap !== null) {
    capYears = null;
    capBasis = 'prior';
    maxAllowedCap = priorCap;
  } else if (under75DuringYear && balance < twoYearThreshold) {
    capYears = balance < threeYearThreshold ? 3 : 2;
    capBasis = 'bring-forward';
    maxAllowedCap = annualCap * capYears;
  }

  const excess = Math.max(0, contribution - Math.round(maxAllowedCap * 100));
  const keepTax = Math.round(excess * (PARAMETERS.keepTaxRate / 100));
  let releaseAmount = 0;
  let releaseTax = 0;
  if (excess > 0) {
    releaseAmount = earnings === null ? null
      : excess + Math.round(earnings * (PARAMETERS.releasedEarningsPercent / 100));
    releaseTax = earnings === 0 ? 0 : null;
    if (earnings !== null && rate !== null) {
      const rateAfterOffset = Math.max(0, Math.round(rate * 100) - PARAMETERS.earningsOffsetPercent * 100);
      releaseTax = Math.round(earnings * (rateAfterOffset / 10_000));
    }
  }

  return {
    capYears,
    capBasis,
    maxAllowedCap,
    triggersBringForward: capBasis === 'bring-forward' && contribution > annualCap * 100,
    excessNcc: excess / 100,
    keepTax: keepTax / 100,
    releaseAmount: releaseAmount === null ? null : releaseAmount / 100,
    releaseTax: releaseTax === null ? null : releaseTax / 100,
    taxDifference: releaseTax === null ? null : (keepTax - releaseTax) / 100,
  };
}
