export const PARAMETERS = Object.freeze({
  earlyDistributionAge: 59.5,
  earlyDistributionRate: 0.10,
  lumpWithholding: 0.30,
  periodicWithholding: 0.15,
  capitalGainsInclusion: 0.50,
  rrspDollarLimit: 33810,
});

function validateRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

function validateWholeYears(value, minimum, maximum, label) {
  validateRange(value, minimum, maximum, label);
  if (!Number.isInteger(value)) throw new RangeError(`${label} must be a whole year.`);
}

export function electionDeadline(selfEmployed) {
  return selfEmployed ? '2027-06-15' : '2027-04-30';
}

function projectTaxable(balance, annualReturn, annualTaxDrag, years) {
  let tax = 0;
  for (let year = 0; year < years; year += 1) {
    const taxThisYear = balance * annualTaxDrag;
    tax += taxThisYear;
    balance += balance * annualReturn - taxThisYear;
  }
  return { balance, tax };
}

export function calculateRoth({
  balance, growth, yieldRate, years, marginalRate, realizedShare,
  contribution, contributionYear, election,
}) {
  validateRange(balance, 0, 1e9, 'Roth balance');
  validateRange(growth, -0.5, 0.5, 'Capital growth');
  validateRange(yieldRate, 0, 0.25, 'Dividend and interest yield');
  validateWholeYears(years, 10, 30, 'Projection length');
  validateRange(marginalRate, 0, 1, 'Combined marginal tax rate');
  validateRange(realizedShare, 0, 1, 'Capital growth realized annually');
  validateRange(contribution, 0, 1e9, 'Canadian Contribution');
  if (contribution > 0) validateWholeYears(contributionYear, 1, years, 'Contribution year');
  if (!['filed', 'pending', 'missed'].includes(election)) throw new RangeError('Choose an election status.');

  const annualReturn = growth + yieldRate;
  const annualTaxDrag = marginalRate * (
    yieldRate + Math.max(0, growth) * realizedShare * PARAMETERS.capitalGainsInclusion
  );
  const finalTaxFreeBalance = balance * (1 + annualReturn) ** years;
  const noElection = projectTaxable(balance, annualReturn, annualTaxDrag, years);

  // The first Canadian Contribution freezes the balance before the contribution.
  // Returns on the full invested balance can be exposed from that point forward.
  const protectedYears = contribution > 0 ? contributionYear - 1 : years;
  const postContributionYears = years - protectedYears;
  const preContributionBalance = balance * (1 + annualReturn) ** protectedYears;
  const exposedAfterContribution = projectTaxable(
    preContributionBalance + contribution, annualReturn, annualTaxDrag, postContributionYears,
  );
  const contributedDollars = projectTaxable(contribution, annualReturn, annualTaxDrag, postContributionYears);
  const originalBalanceAfterContribution = projectTaxable(
    preContributionBalance, annualReturn, annualTaxDrag, postContributionYears,
  );
  const projections = {
    filed: {
      projectedBalance: exposedAfterContribution.balance,
      projectedTax: exposedAfterContribution.tax,
      protectedBalance: Math.min(preContributionBalance, exposedAfterContribution.balance),
    },
    missed: {
      projectedBalance: noElection.balance + contributedDollars.balance,
      projectedTax: noElection.tax + contributedDollars.tax,
      protectedBalance: 0,
    },
    pending: { projectedBalance: null, projectedTax: null, protectedBalance: null },
  };

  return {
    finalTaxFreeBalance,
    noElectionBalance: noElection.balance,
    electionWealthGap: Math.max(0, finalTaxFreeBalance - noElection.balance),
    unprotectedTax: noElection.tax,
    annualTaxDrag,
    contributionWealthGap: Math.max(0, finalTaxFreeBalance - originalBalanceAfterContribution.balance),
    ...projections[election],
  };
}

function earlyDistributionTax(balance, age) {
  return age < PARAMETERS.earlyDistributionAge ? balance * PARAMETERS.earlyDistributionRate : 0;
}

export function calculateRetirement({
  balance, age, years, annualReturn, canadaRate, retirementRate,
  payout, room, transferEligible, outsideCash, earlyException, creditEarlyTax,
}) {
  validateRange(balance, 0, 1e9, 'US retirement balance');
  validateRange(age, 18, 100, 'Current age');
  validateWholeYears(years, 10, 30, 'Projection length');
  validateRange(annualReturn, -0.5, 0.5, 'Annual return');
  validateRange(canadaRate, 0, 1, 'Canadian tax rate today');
  validateRange(retirementRate, 0, 1, 'Canadian tax rate at retirement');
  validateRange(room, 0, 1e9, 'Available RRSP room');
  validateRange(transferEligible, 0, 1e9, 'Confirmed eligible lump-sum transfer');
  validateRange(outsideCash, 0, 1e9, 'Outside cash for deposit');
  if (!['lump', 'periodic'].includes(payout)) throw new RangeError('Choose a payout type.');

  const withholdingRate = payout === 'lump' ? PARAMETERS.lumpWithholding : PARAMETERS.periodicWithholding;
  const withholding = balance * withholdingRate;
  const earlyTax = earlyException ? 0 : earlyDistributionTax(balance, age);
  const cashAtPayout = balance - withholding;
  const eligibleLumpSum = payout === 'lump' ? Math.min(balance, transferEligible) : 0;
  const rrspDeposit = Math.min(balance, cashAtPayout + outsideCash, eligibleLumpSum + room);
  const specialDeduction = Math.min(rrspDeposit, eligibleLumpSum);
  const roomUsed = rrspDeposit - specialDeduction;
  const caGrossTax = (balance - rrspDeposit) * canadaRate;
  const eligibleUSTax = withholding + (creditEarlyTax ? earlyTax : 0);
  const credit = Math.min(caGrossTax, eligibleUSTax);
  const caNetTax = caGrossTax - credit;
  const outsideNet = cashAtPayout - earlyTax - caNetTax - rrspDeposit;

  const factor = (1 + annualReturn) ** years;
  const holdGross = balance * factor;
  const holdUSTax = holdGross * PARAMETERS.periodicWithholding;
  const holdEarlyTax = earlyDistributionTax(holdGross, age + years);
  const holdCaTax = holdGross * retirementRate;
  const holdEligibleUSTax = holdUSTax + (creditEarlyTax ? holdEarlyTax : 0);
  const holdCredit = Math.min(holdCaTax, holdEligibleUSTax);
  const holdNet = holdGross - holdUSTax - holdEarlyTax - (holdCaTax - holdCredit);
  const rrspNet = rrspDeposit * factor * (1 - retirementRate);
  const cashNet = rrspNet + outsideNet;

  return {
    withholdingRate, withholding, earlyTax, cashAtPayout, rrspDeposit, specialDeduction, roomUsed,
    caGrossTax, credit, caNetTax, eligibleUSTax, unusedEligibleUSTax: eligibleUSTax - credit,
    outsideNet, outsideCashNeeded: Math.max(0, -outsideNet),
    holdGross, holdUSTax, holdEarlyTax, holdCredit, holdNet, rrspNet, cashNet,
    holdAdvantage: holdNet - cashNet,
  };
}
