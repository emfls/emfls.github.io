// 2026 IRS Rev. Proc. 2025-19 Statutory HDHP & HSA Parameters
export const HDHP_HSA_CONSTANTS_2026 = {
  minDeductible: {
    self: 1700,
    family: 3400
  },
  maxOutOfPocket: {
    self: 8500,
    family: 17000
  },
  maxHsaContribution: {
    self: 4400,
    family: 8750
  },
  catchUp55Plus: 1000,
  ficaRate: 0.0765 // 6.2% SS + 1.45% Medicare pre-tax payroll HSA exemption
};

export function calcHealthPlanEconomics(params) {
  const coverageType = params.coverageType || 'self'; // 'self' or 'family'
  const is55Plus = Boolean(params.is55Plus);
  const marginalTaxRate = Math.max(0, parseFloat(params.marginalTaxRate) || 0.22);
  const stateTaxRate = Math.max(0, parseFloat(params.stateTaxRate) || 0.05);

  // HDHP Plan Parameters
  const hdhpMonthlyPremium = Math.max(0, parseFloat(params.hdhpMonthlyPremium) || 120);
  const hdhpDeductible = Math.max(
    coverageType === 'self' ? HDHP_HSA_CONSTANTS_2026.minDeductible.self : HDHP_HSA_CONSTANTS_2026.minDeductible.family,
    parseFloat(params.hdhpDeductible) || (coverageType === 'self' ? 2000 : 4000)
  );
  const hdhpCoinsurance = Math.max(0, Math.min(1, parseFloat(params.hdhpCoinsurance) || 0.20));
  const hdhpOutOfPocketMax = Math.min(
    coverageType === 'self' ? HDHP_HSA_CONSTANTS_2026.maxOutOfPocket.self : HDHP_HSA_CONSTANTS_2026.maxOutOfPocket.family,
    parseFloat(params.hdhpOutOfPocketMax) || (coverageType === 'self' ? 5000 : 10000)
  );
  const employerHsaContribution = Math.max(0, parseFloat(params.employerHsaContribution) || 750);
  const employeeHsaContribution = Math.max(0, parseFloat(params.employeeHsaContribution) || (coverageType === 'self' ? 3650 : 8000));

  // PPO Plan Parameters
  const ppoMonthlyPremium = Math.max(0, parseFloat(params.ppoMonthlyPremium) || 280);
  const ppoDeductible = Math.max(0, parseFloat(params.ppoDeductible) || (coverageType === 'self' ? 750 : 1500));
  const ppoCoinsurance = Math.max(0, Math.min(1, parseFloat(params.ppoCoinsurance) || 0.20));
  const ppoOutOfPocketMax = Math.max(0, parseFloat(params.ppoOutOfPocketMax) || (coverageType === 'self' ? 4000 : 8000));

  // HSA Max limit check
  const maxAllowedHsa = (coverageType === 'self' ? HDHP_HSA_CONSTANTS_2026.maxHsaContribution.self : HDHP_HSA_CONSTANTS_2026.maxHsaContribution.family)
    + (is55Plus ? HDHP_HSA_CONSTANTS_2026.catchUp55Plus : 0);
  const totalHsaContributed = Math.min(maxAllowedHsa, employerHsaContribution + employeeHsaContribution);
  const actualEmployeeHsa = Math.max(0, totalHsaContributed - employerHsaContribution);

  // Triple Tax Advantage Savings on employee HSA contribution (Federal + State + FICA)
  // Note: CA and NJ do not exempt state tax on HSA, but federal & FICA always apply
  const effectiveHsaTaxRate = marginalTaxRate + stateTaxRate + HDHP_HSA_CONSTANTS_2026.ficaRate;
  const hsaTaxSavings = actualEmployeeHsa * effectiveHsaTaxRate;

  // Annual Premiums
  const hdhpAnnualPremium = hdhpMonthlyPremium * 12;
  const ppoAnnualPremium = ppoMonthlyPremium * 12;
  const premiumSavings = ppoAnnualPremium - hdhpAnnualPremium;

  function calcScenarioCost(grossMedicalSpend) {
    // 1. HDHP Out of Pocket
    let hdhpPatientMedical = 0;
    if (grossMedicalSpend <= hdhpDeductible) {
      hdhpPatientMedical = grossMedicalSpend;
    } else {
      const remainingSpend = grossMedicalSpend - hdhpDeductible;
      hdhpPatientMedical = hdhpDeductible + (remainingSpend * hdhpCoinsurance);
    }
    hdhpPatientMedical = Math.min(hdhpOutOfPocketMax, hdhpPatientMedical);

    // Net HDHP Annual Cost = Annual Premium + Patient Medical Cost - Employer HSA Seed - Employee HSA Tax Savings
    const hdhpNetCost = hdhpAnnualPremium + hdhpPatientMedical - employerHsaContribution - hsaTaxSavings;

    // 2. PPO Out of Pocket
    let ppoPatientMedical = 0;
    if (grossMedicalSpend <= ppoDeductible) {
      ppoPatientMedical = grossMedicalSpend;
    } else {
      const remainingSpend = grossMedicalSpend - ppoDeductible;
      ppoPatientMedical = ppoDeductible + (remainingSpend * ppoCoinsurance);
    }
    ppoPatientMedical = Math.min(ppoOutOfPocketMax, ppoPatientMedical);

    // Net PPO Annual Cost = Annual Premium + Patient Medical Cost
    const ppoNetCost = ppoAnnualPremium + ppoPatientMedical;

    const diff = ppoNetCost - hdhpNetCost; // positive means HDHP is cheaper

    return {
      grossMedicalSpend,
      hdhpPatientMedical,
      hdhpNetCost,
      ppoPatientMedical,
      ppoNetCost,
      hdhpSavings: diff,
      recommendation: diff >= 0 ? 'HDHP_WINS' : 'PPO_WINS'
    };
  }

  // Pre-calculated standardized scenarios
  const lowUsage = calcScenarioCost(500);
  const expectedUsage = calcScenarioCost(3500);
  const catastrophicUsage = calcScenarioCost(50000);

  // Calculate Breakeven Medical Spend Point (where PPO cost == HDHP cost)
  // Binary search between $0 and $100,000
  let low = 0;
  let high = 100000;
  let breakeven = null;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (low + high) / 2;
    const res = calcScenarioCost(mid);
    if (Math.abs(res.hdhpSavings) < 1.0) {
      breakeven = Math.round(mid);
      break;
    }
    if (res.hdhpSavings > 0) {
      // HDHP is still cheaper, try higher medical spend
      low = mid;
    } else {
      high = mid;
    }
  }
  if (!breakeven && high >= 99990) {
    breakeven = high; // HDHP dominates up to max
  }

  return {
    coverageType,
    maxAllowedHsa,
    maxHsaAllowed: maxAllowedHsa,
    totalHsaContributed,
    hsaTotalContribution: totalHsaContributed,
    actualEmployeeHsa,
    hsaTaxSavings,
    hdhpAnnualPremium,
    annualHdhpPremium: hdhpAnnualPremium,
    ppoAnnualPremium,
    annualPpoPremium: ppoAnnualPremium,
    premiumSavings,
    premiumSavingsWithHdhp: premiumSavings,
    guaranteedHdhpAdvantage: premiumSavings + employerHsaContribution + hsaTaxSavings,
    totalGuaranteedSubsidy: premiumSavings + employerHsaContribution + hsaTaxSavings,
    lowUsage,
    expectedUsage,
    catastrophicUsage,
    scenarios: {
      low: {
        hdhpOop: lowUsage.hdhpPatientMedical,
        hdhpTotalNetCost: lowUsage.hdhpNetCost,
        ppoOop: lowUsage.ppoPatientMedical,
        ppoTotalNetCost: lowUsage.ppoNetCost
      },
      expected: {
        hdhpOop: expectedUsage.hdhpPatientMedical,
        hdhpTotalNetCost: expectedUsage.hdhpNetCost,
        ppoOop: expectedUsage.ppoPatientMedical,
        ppoTotalNetCost: expectedUsage.ppoNetCost
      },
      catastrophic: {
        hdhpOop: catastrophicUsage.hdhpPatientMedical,
        hdhpTotalNetCost: catastrophicUsage.hdhpNetCost,
        ppoOop: catastrophicUsage.ppoPatientMedical,
        ppoTotalNetCost: catastrophicUsage.ppoNetCost
      }
    },
    breakeven,
    breakevenMedicalSpend: breakeven
  };
}
