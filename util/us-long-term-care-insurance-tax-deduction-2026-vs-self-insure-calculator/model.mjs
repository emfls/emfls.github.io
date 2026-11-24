// US Long-Term Care Insurance (LTCI) Engine - 2026 IRS Rev. Proc. 2025-32
export function getIrsCap(age) {
  if (age <= 0) return 0;
  if (age <= 40) return 500;
  if (age <= 50) return 930;
  if (age <= 60) return 1860;
  if (age <= 70) return 4960;
  return 6200;
}

export function calculateLTCITaxDeduction(params) {
  const {
    age,
    taxpayerType = "self_employed", // "self_employed" or "w2_itemizer"
    annualPremium,
    agi = 100000,
    otherMedical = 0,
    marginalTaxRate = 24, // percentage
    spouseAge = 0,
    spousePremium = 0
  } = params;

  if (age <= 0 || annualPremium <= 0) {
    throw new RangeError("Age and annual premium must be positive numbers.");
  }

  const irsCapPrimary = getIrsCap(age);
  const eligiblePremiumPrimary = Math.min(annualPremium, irsCapPrimary);

  let irsCapSpouse = 0;
  let eligiblePremiumSpouse = 0;
  if (spouseAge > 0 && spousePremium > 0) {
    irsCapSpouse = getIrsCap(spouseAge);
    eligiblePremiumSpouse = Math.min(spousePremium, irsCapSpouse);
  }

  const totalEligiblePremium = eligiblePremiumPrimary + eligiblePremiumSpouse;
  const totalPaidPremium = annualPremium + spousePremium;

  let deductibleAmount = 0;
  const medicalFloor = agi * 0.075;

  if (taxpayerType === "self_employed") {
    // 100% above-the-line deduction on Schedule 1 Line 17, bypassing the 7.5% AGI hurdle
    deductibleAmount = totalEligiblePremium;
  } else {
    // W-2 Itemizer on Schedule A: subject to 7.5% AGI medical expense floor
    const totalMedicalExpenses = otherMedical + totalEligiblePremium;
    const excessOverFloor = Math.max(0, totalMedicalExpenses - medicalFloor);
    deductibleAmount = Math.min(excessOverFloor, totalEligiblePremium);
  }

  const taxSavings = deductibleAmount * (marginalTaxRate / 100);
  const netEffectivePremium = totalPaidPremium - taxSavings;

  return {
    irsCapPrimary,
    irsCapSpouse,
    totalEligiblePremium,
    totalPaidPremium,
    deductibleAmount,
    taxSavings,
    netEffectivePremium,
    taxpayerType
  };
}

export function simulateCareComparison(params) {
  const {
    currentAge,
    careAge = 83,
    annualPremium,
    annualTaxSavings = 0,
    monthlyBenefit = 6000,
    inflationRiderPct = 3.0,
    annualCareCostToday = 115000,
    careInflationPct = 4.5,
    investmentReturnPct = 6.0
  } = params;

  if (currentAge >= careAge) {
    throw new RangeError("Current age must be less than projected care age.");
  }

  const yearsToCare = careAge - currentAge;
  const netAnnualCost = annualPremium - annualTaxSavings;

  // Sinking fund value at care age if investing after-tax premium savings
  let selfInsureFund = 0;
  for (let i = 0; i < yearsToCare; i++) {
    selfInsureFund = (selfInsureFund + netAnnualCost) * (1 + investmentReturnPct / 100);
  }

  // Cost of care in Year 1 of need
  const careCostYear1 = annualCareCostToday * Math.pow(1 + careInflationPct / 100, yearsToCare);
  const annualPolicyBenefitYear1 = (monthlyBenefit * 12) * Math.pow(1 + inflationRiderPct / 100, yearsToCare);

  function simulateEvent(years) {
    if (years === 0) {
      return {
        totalCareCost: 0,
        selfInsureOutPocket: 0,
        selfInsureEstateNet: selfInsureFund,
        ltciBenefitPaid: 0,
        ltciOutPocket: 0,
        ltciPreservationAdvantage: -selfInsureFund // Paid premiums, no claims
      };
    }

    let cumCareCost = 0;
    let cumPolicyPaid = 0;
    let currentCost = careCostYear1;
    let currentBenefit = annualPolicyBenefitYear1;

    for (let y = 0; y < years; y++) {
      cumCareCost += currentCost;
      cumPolicyPaid += Math.min(currentCost, currentBenefit);
      currentCost *= (1 + careInflationPct / 100);
      currentBenefit *= (1 + inflationRiderPct / 100);
    }

    const selfInsureOutPocket = cumCareCost;
    const selfInsureEstateNet = selfInsureFund - selfInsureOutPocket;
    const ltciOutPocket = Math.max(0, cumCareCost - cumPolicyPaid);
    const ltciPreservationAdvantage = selfInsureOutPocket - (selfInsureFund + ltciOutPocket);

    return {
      totalCareCost: cumCareCost,
      selfInsureOutPocket,
      selfInsureEstateNet,
      ltciBenefitPaid: cumPolicyPaid,
      ltciOutPocket,
      ltciPreservationAdvantage
    };
  }

  return {
    yearsToCare,
    netAnnualCost,
    selfInsureFundAtCare: selfInsureFund,
    careCostYear1,
    annualPolicyBenefitYear1,
    event0Yr: simulateEvent(0),
    event3Yr: simulateEvent(3),
    event5Yr: simulateEvent(5)
  };
}

export function computeLTCIPlan(inputs) {
  const taxResults = calculateLTCITaxDeduction(inputs);
  const simResults = simulateCareComparison({
    currentAge: inputs.age,
    careAge: inputs.careAge || 83,
    annualPremium: inputs.annualPremium,
    annualTaxSavings: taxResults.taxSavings,
    monthlyBenefit: inputs.monthlyBenefit || 6000,
    inflationRiderPct: inputs.inflationRiderPct !== undefined ? inputs.inflationRiderPct : 3.0,
    annualCareCostToday: inputs.annualCareCostToday || 115000,
    careInflationPct: inputs.careInflationPct !== undefined ? inputs.careInflationPct : 4.5,
    investmentReturnPct: inputs.investmentReturnPct !== undefined ? inputs.investmentReturnPct : 6.0
  });

  return {
    tax: taxResults,
    sim: simResults
  };
}
