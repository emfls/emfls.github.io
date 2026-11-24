export const INCLUSION_RATE = 1 / 2;
export const PROPOSED_INCLUSION_RATE = 2 / 3;
export const PROPOSAL_THRESHOLD = 250_000;
export const LCGE_LIMIT = 1_275_000;

export const TOP_RATES = Object.freeze({
  ON: 53.53, BC: 53.50, AB: 48.00, QC: 53.31, SK: 47.50,
  MB: 50.40, NS: 54.00, NB: 52.50, NL: 54.80, PE: 53.00,
});

function cents(value, label) {
  // Subtract in cents so equal sale and cost totals net to exactly zero.
  const amount = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > 1e12 ||
      value !== amount / 100) {
    throw new RangeError(`${label} must be between 0 and 1 trillion CAD, to the nearest cent.`);
  }
  return amount;
}

export function principalResidenceFraction(ownershipYears, designatedYears, residentAtAcquisition) {
  if (!Number.isSafeInteger(ownershipYears) || ownershipYears < 1 ||
      !Number.isSafeInteger(designatedYears) || designatedYears < 0 ||
      designatedYears > ownershipYears || typeof residentAtAcquisition !== 'boolean') {
    throw new RangeError('Enter whole ownership years (at least 1) and eligible designated years (0 to years owned).');
  }
  if (designatedYears === 0) return 0;
  return Math.min(1, (designatedYears + Number(residentAtAcquisition)) / ownershipYears);
}

export function calculateCapitalGains({
  proceeds, adjustedCostBase, sellingExpenses = 0, capitalLosses = 0,
  asset = 'investment', ownershipYears, designatedYears, residentAtAcquisition,
  priorLcgeUsed = 0, province = 'ON', customRate,
}) {
  if (!['investment', 'residence', 'qualified'].includes(asset)) {
    throw new RangeError('Select a supported asset type.');
  }
  const marginalRate = province === 'custom' ? customRate : TOP_RATES[province];
  if (!Number.isFinite(marginalRate) || marginalRate < 0 || marginalRate > 100) {
    throw new RangeError('Select a province or enter a custom marginal rate between 0% and 100%.');
  }

  const grossGainCents = cents(proceeds, 'Proceeds') -
    cents(adjustedCostBase, 'Adjusted cost base') - cents(sellingExpenses, 'Selling expenses');
  const lossCents = cents(capitalLosses, 'Other eligible capital losses');
  const exemptFraction = asset === 'residence'
    ? principalResidenceFraction(ownershipYears, designatedYears, residentAtAcquisition)
    : 0;
  const preExempt = Math.max(0, grossGainCents) * exemptFraction / 100;
  const residenceLossDisallowed = asset === 'residence' && grossGainCents < 0;
  const gainAfterPreCents = residenceLossDisallowed ? 0 : grossGainCents * (1 - exemptFraction);
  const netCapitalGain = (gainAfterPreCents - lossCents) / 100;
  const grossGainAfterLosses = Math.max(0, netCapitalGain);
  const remainingLcge = asset === 'qualified'
    ? Math.max(0, LCGE_LIMIT - cents(priorLcgeUsed, 'Prior LCGE used') / 100)
    : 0;
  const lcgeApplied = Math.min(grossGainAfterLosses, remainingLcge);
  const taxableCapitalGain = grossGainAfterLosses * INCLUSION_RATE;
  const lcgeDeduction = lcgeApplied * INCLUSION_RATE;
  const gainAfterLcge = grossGainAfterLosses - lcgeApplied;
  const netTaxableCapitalGain = gainAfterLcge * INCLUSION_RATE;
  const rate = marginalRate / 100;
  const estimatedTax = netTaxableCapitalGain * rate;
  const proposalExcess = Math.max(0, gainAfterLcge - PROPOSAL_THRESHOLD);
  const taxSaved = proposalExcess * (PROPOSED_INCLUSION_RATE - INCLUSION_RATE) * rate;

  return {
    grossGain: grossGainCents / 100,
    netCapitalGain,
    exemptFraction,
    preExempt,
    remainingLcge,
    lcgeApplied,
    taxableCapitalGain,
    lcgeDeduction,
    netTaxableCapitalGain,
    marginalRate,
    estimatedTax,
    effectiveRate: grossGainAfterLosses > 0 ? estimatedTax / grossGainAfterLosses * 100 : 0,
    proposalTax: estimatedTax + taxSaved,
    taxSaved,
    showComparison: grossGainAfterLosses > PROPOSAL_THRESHOLD,
    amtReview: lcgeApplied > 0,
    residenceLossDisallowed,
  };
}
