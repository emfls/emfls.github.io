// Canadian OSB Directive No. 11R2-2026 Surplus Income & Proposal Standards
export const OSB_2026_THRESHOLDS = {
  1: 2716,
  2: 3381,
  3: 4157,
  4: 5047,
  5: 5724,
  6: 6456,
  7: 7188
};

export function getOSBThreshold(familySize) {
  const size = Math.max(1, Math.min(7, Math.floor(familySize)));
  return OSB_2026_THRESHOLDS[size];
}

export function calcBankruptcySurplus(familySize, netMonthlyIncome, nonDiscretionaryExpenses = 0) {
  const threshold = getOSBThreshold(familySize);
  const availableIncome = Math.max(0, netMonthlyIncome - nonDiscretionaryExpenses);
  const excess = Math.max(0, availableIncome - threshold);
  
  // OSB Directive: 50% of excess is payable as surplus income
  const monthlySurplusPayment = excess * 0.50;
  
  // If excess >= $200, bankruptcy is extended from 9 months to 21 months (first-time bankrupt)
  const hasSurplus = excess >= 200;
  const bankruptcyMonths = hasSurplus ? 21 : 9;
  const totalSurplusPaid = monthlySurplusPayment * bankruptcyMonths;
  const baseTrusteeFee = hasSurplus ? 0 : 1800; // Minimum trustee fee if surplus is under threshold
  const totalBankruptcyCost = totalSurplusPaid + baseTrusteeFee;

  return {
    threshold,
    availableIncome,
    excess,
    hasSurplus,
    monthlySurplusPayment,
    bankruptcyMonths,
    totalSurplusPaid,
    totalBankruptcyCost
  };
}

export function calcConsumerProposal(unsecuredDebt, settlementPct = 0.35, termMonths = 60) {
  const settlementAmount = unsecuredDebt * settlementPct;
  const monthlyPayment = settlementAmount / termMonths;
  const debtForgiven = unsecuredDebt - settlementAmount;

  return {
    settlementAmount,
    monthlyPayment,
    termMonths,
    debtForgiven,
    totalCost: settlementAmount // 0% interest, all trustee fees included
  };
}

export function computeInsolvencyOptions(inputs) {
  const {
    unsecuredDebt = 50000,
    familySize = 4,
    netMonthlyIncome = 6000,
    nonDiscretionaryExpenses = 300,
    proposalSettlementPct = 0.35,
    proposalMonths = 60
  } = inputs;

  if (unsecuredDebt <= 0 || isNaN(unsecuredDebt)) throw new RangeError('Debt must be positive');
  if (netMonthlyIncome <= 0 || isNaN(netMonthlyIncome)) throw new RangeError('Income must be positive');

  const bankruptcy = calcBankruptcySurplus(familySize, netMonthlyIncome, nonDiscretionaryExpenses);
  const proposal = calcConsumerProposal(unsecuredDebt, proposalSettlementPct, proposalMonths);

  const proposalSavingsVsDebt = unsecuredDebt - proposal.totalCost;
  const proposalMonthlyVsSurplus = bankruptcy.monthlySurplusPayment - proposal.monthlyPayment;

  return {
    unsecuredDebt,
    familySize,
    bankruptcy,
    proposal,
    proposalSavingsVsDebt,
    proposalMonthlyVsSurplus
  };
}
