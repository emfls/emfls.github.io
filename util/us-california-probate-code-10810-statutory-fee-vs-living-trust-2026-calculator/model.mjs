/**
 * Tool 481: 2026 California Probate Code §10810 Statutory Fee Calculator
 * Pure deterministic ESM module.
 */

export const PROBATE_BRACKETS = [
  { limit: 100000, rate: 0.04 },    // 4% on first $100,000 ($4,000)
  { limit: 100000, rate: 0.03 },    // 3% on next $100,000 ($3,000)
  { limit: 800000, rate: 0.02 },    // 2% on next $800,000 ($16,000)
  { limit: 9000000, rate: 0.01 },   // 1% on next $9,000,000 ($90,000)
  { limit: 15000000, rate: 0.005 }, // 0.5% on next $15,000,000 ($75,000)
];

export const COURT_FILING_FEE = 870;      // CA Probate initial petition ($435) + final distribution ($435)
export const ESTIMATED_TRUST_COST = 3000; // Typical attorney-drafted comprehensive Living Trust package

/**
 * Calculates statutory probate fees per role under Cal. Prob. Code §10810 / §10800
 * @param {number} grossEstateValue Gross fair market value of real estate and personal property
 */
export function calcSingleRoleStatutoryFee(grossEstateValue) {
  let val = Math.max(0, grossEstateValue);
  let fee = 0;

  for (const b of PROBATE_BRACKETS) {
    if (val <= 0) break;
    const chunk = Math.min(val, b.limit);
    fee += chunk * b.rate;
    val -= chunk;
  }

  // Over $25M: reasonable amount determined by court, modeled at 0.25%
  if (val > 0) {
    fee += val * 0.0025;
  }

  return Math.round(fee);
}

/**
 * Full California Probate Cost vs Living Trust Analysis
 * @param {Object} params
 * @param {number} params.grossEstateValue Gross Fair Market Value of estate (debts NOT deducted)
 * @param {number} params.mortgageAndDebts Total mortgages and liabilities (for equity context)
 * @param {boolean} params.bothRolesPaid Whether both Attorney and Executor take full statutory fee
 * @param {number} params.trustPackageCost Cost of establishing Living Trust
 */
export function calcCaliforniaProbateVsTrust(params) {
  const grossEstate = Math.max(0, parseFloat(params.grossEstateValue) || 0);
  const debts = Math.max(0, parseFloat(params.mortgageAndDebts) || 0);
  const bothRolesPaid = params.bothRolesPaid !== undefined ? Boolean(params.bothRolesPaid) : true;
  const trustCost = Math.max(0, parseFloat(params.trustPackageCost) || ESTIMATED_TRUST_COST);

  const netEquity = Math.max(0, grossEstate - debts);

  // Statutory Fees (Probate Code §10810 for Attorney, §10800 for Executor)
  const attorneyFee = calcSingleRoleStatutoryFee(grossEstate);
  const executorFee = bothRolesPaid ? attorneyFee : 0;
  const totalStatutoryFees = attorneyFee + executorFee;

  // Ancillary Probate Costs: Referee (0.1%), Court Filing, Publication/Bond
  const refereeFee = grossEstate > 0 ? Math.max(100, Math.round(grossEstate * 0.001)) : 0;
  const miscAdminCost = grossEstate > 0 ? 1500 : 0; // Publication, notice, certified copies
  const totalProbateCost = totalStatutoryFees + COURT_FILING_FEE + refereeFee + miscAdminCost;

  // Comparison with Living Trust
  const netSavingsWithTrust = Math.max(0, totalProbateCost - trustCost);
  const probateCostPercentOfEquity = netEquity > 0 ? Number(((totalProbateCost / netEquity) * 100).toFixed(1)) : 0;
  const probateCostPercentOfGross = grossEstate > 0 ? Number(((totalProbateCost / grossEstate) * 100).toFixed(2)) : 0;

  return {
    grossEstate,
    debts,
    netEquity,
    bothRolesPaid,
    attorneyFee,
    executorFee,
    totalStatutoryFees,
    courtFilingFee: COURT_FILING_FEE,
    refereeFee,
    miscAdminCost,
    totalProbateCost,
    trustCost,
    netSavingsWithTrust,
    probateCostPercentOfEquity,
    probateCostPercentOfGross
  };
}
