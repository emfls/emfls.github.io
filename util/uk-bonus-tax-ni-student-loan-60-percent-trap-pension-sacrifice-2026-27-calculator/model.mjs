// 2026/27 UK PAYE Income Tax, National Insurance, Student Loan & Salary Sacrifice Constants
export const UK_TAX_CONSTANTS_2026_27 = {
  personalAllowance: 12570,
  basicRateLimit: 50270,
  higherRateLimit: 125140,
  paTaperThreshold: 100000,
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
  paTaperEffectiveRate: 0.60, // 40% higher rate + 20% loss of personal allowance
  
  // Employee NI thresholds (annualized for calculation)
  niPrimaryThreshold: 12570,
  niUpperEarningsLimit: 50270,
  niStandardRate: 0.08, // 8% between PT and UEL
  niUpperRate: 0.02, // 2% above UEL

  // Student loan plan thresholds (annual)
  studentLoanPlans: {
    'none': { rate: 0.0, threshold: Infinity },
    'plan1': { rate: 0.09, threshold: 24990 },
    'plan2': { rate: 0.09, threshold: 27295 },
    'plan4': { rate: 0.09, threshold: 31395 },
    'plan5': { rate: 0.09, threshold: 25000 }
  },
  postgradLoanRate: 0.06,
  postgradLoanThreshold: 21000,
  
  // Employer NI Class 1 (Autumn Budget 2024 revised to 15.0% from April 2025 onwards)
  employerNiRate: 0.150
};

export function calcUkIncomeTaxAnnual(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  
  // Calculate adjusted personal allowance with taper over £100,000
  let pa = UK_TAX_CONSTANTS_2026_27.personalAllowance;
  if (taxableIncome > UK_TAX_CONSTANTS_2026_27.paTaperThreshold) {
    const excess = taxableIncome - UK_TAX_CONSTANTS_2026_27.paTaperThreshold;
    const reduction = excess / 2;
    pa = Math.max(0, pa - reduction);
  }

  const netTaxable = Math.max(0, taxableIncome - pa);
  if (netTaxable <= 0) return 0;

  let tax = 0;
  const basicBandWidth = 37700; // £50,270 - £12,570
  const higherRateThreshold = 125140; // Additional rate (45%) threshold on taxable income
  
  if (netTaxable <= basicBandWidth) {
    tax += netTaxable * UK_TAX_CONSTANTS_2026_27.basicRate;
  } else {
    tax += basicBandWidth * UK_TAX_CONSTANTS_2026_27.basicRate;
    if (netTaxable <= higherRateThreshold) {
      tax += (netTaxable - basicBandWidth) * UK_TAX_CONSTANTS_2026_27.higherRate;
    } else {
      tax += (higherRateThreshold - basicBandWidth) * UK_TAX_CONSTANTS_2026_27.higherRate;
      tax += (netTaxable - higherRateThreshold) * UK_TAX_CONSTANTS_2026_27.additionalRate;
    }
  }

  return tax;
}

export function calcUkNiAnnual(annualEarnings) {
  if (annualEarnings <= UK_TAX_CONSTANTS_2026_27.niPrimaryThreshold) return 0;
  if (annualEarnings <= UK_TAX_CONSTANTS_2026_27.niUpperEarningsLimit) {
    return (annualEarnings - UK_TAX_CONSTANTS_2026_27.niPrimaryThreshold) * UK_TAX_CONSTANTS_2026_27.niStandardRate;
  }
  const standardNi = (UK_TAX_CONSTANTS_2026_27.niUpperEarningsLimit - UK_TAX_CONSTANTS_2026_27.niPrimaryThreshold) * UK_TAX_CONSTANTS_2026_27.niStandardRate;
  const upperNi = (annualEarnings - UK_TAX_CONSTANTS_2026_27.niUpperEarningsLimit) * UK_TAX_CONSTANTS_2026_27.niUpperRate;
  return standardNi + upperNi;
}

export function calcStudentLoanRepayment(annualEarnings, plan = 'none', hasPostgrad = false) {
  let rep = 0;
  const slDef = UK_TAX_CONSTANTS_2026_27.studentLoanPlans[plan];
  if (slDef && slDef.rate > 0 && annualEarnings > slDef.threshold) {
    rep += (annualEarnings - slDef.threshold) * slDef.rate;
  }
  if (hasPostgrad && annualEarnings > UK_TAX_CONSTANTS_2026_27.postgradLoanThreshold) {
    rep += (annualEarnings - UK_TAX_CONSTANTS_2026_27.postgradLoanThreshold) * UK_TAX_CONSTANTS_2026_27.postgradLoanRate;
  }
  return rep;
}

export function calcBonusTaxNiSacrifice(params) {
  const baseSalary = Math.max(0, parseFloat(params.baseSalary) || 85000);
  const bonusGross = Math.max(0, parseFloat(params.bonusGross) || 20000);
  const sacrificePercent = Math.max(0, Math.min(100, parseFloat(params.sacrificePercent) || 0));
  const studentLoanPlan = params.studentLoanPlan || 'plan2';
  const hasPostgradLoan = Boolean(params.hasPostgradLoan);
  const employerNiPassThrough = Math.max(0, Math.min(100, parseFloat(params.employerNiPassThrough) || 0)) / 100.0;

  const bonusSacrificed = bonusGross * (sacrificePercent / 100.0);
  const bonusCashGross = bonusGross - bonusSacrificed;

  // 1. Baseline without bonus
  const taxBaseOnly = calcUkIncomeTaxAnnual(baseSalary);

  // 2. Income Tax on Bonus Taken as Cash
  const totalTaxableWithBonus = baseSalary + bonusCashGross;
  const taxWithBonus = calcUkIncomeTaxAnnual(totalTaxableWithBonus);
  const bonusIncomeTax = Math.max(0, taxWithBonus - taxBaseOnly);

  // 3. National Insurance on Bonus Taken as Cash
  // NI is per-pay-period, but annualized here for yearly bonus comparison:
  // If base salary is already above UEL (£50,270), entire bonus is subject to 2% upper rate.
  // If base salary is below UEL, portion up to UEL is at 8%, remainder at 2%.
  let bonusNi = 0;
  if (baseSalary >= UK_TAX_CONSTANTS_2026_27.niUpperEarningsLimit) {
    bonusNi = bonusCashGross * UK_TAX_CONSTANTS_2026_27.niUpperRate;
  } else {
    const roomInStandardNi = UK_TAX_CONSTANTS_2026_27.niUpperEarningsLimit - baseSalary;
    const standardNiPortion = Math.min(bonusCashGross, roomInStandardNi);
    const upperNiPortion = Math.max(0, bonusCashGross - standardNiPortion);
    bonusNi = (standardNiPortion * UK_TAX_CONSTANTS_2026_27.niStandardRate) + (upperNiPortion * UK_TAX_CONSTANTS_2026_27.niUpperRate);
  }

  // 4. Student Loan Repayment on Bonus
  const slDef = UK_TAX_CONSTANTS_2026_27.studentLoanPlans[studentLoanPlan] || UK_TAX_CONSTANTS_2026_27.studentLoanPlans.none;
  let bonusStudentLoan = 0;
  if (slDef.rate > 0) {
    if (baseSalary >= slDef.threshold) {
      bonusStudentLoan += bonusCashGross * slDef.rate;
    } else if (totalTaxableWithBonus > slDef.threshold) {
      const excess = totalTaxableWithBonus - slDef.threshold;
      bonusStudentLoan += excess * slDef.rate;
    }
  }

  // Postgraduate loan
  let bonusPostgradLoan = 0;
  if (hasPostgradLoan) {
    if (baseSalary >= UK_TAX_CONSTANTS_2026_27.postgradLoanThreshold) {
      bonusPostgradLoan += bonusCashGross * UK_TAX_CONSTANTS_2026_27.postgradLoanRate;
    } else if (totalTaxableWithBonus > UK_TAX_CONSTANTS_2026_27.postgradLoanThreshold) {
      const excess = totalTaxableWithBonus - UK_TAX_CONSTANTS_2026_27.postgradLoanThreshold;
      bonusPostgradLoan += excess * UK_TAX_CONSTANTS_2026_27.postgradLoanRate;
    }
  }

  const totalBonusDeductions = bonusIncomeTax + bonusNi + bonusStudentLoan + bonusPostgradLoan;
  const netBonusTakeHome = Math.max(0, bonusCashGross - totalBonusDeductions);
  const effectiveMarginalTaxRate = bonusCashGross > 0 ? (totalBonusDeductions / bonusCashGross) * 100 : 0;

  // 5. Pension Sacrifice Destination
  // Employer saves 15% Class 1 NI on the sacrificed amount
  const employerNiSaved = bonusSacrificed * UK_TAX_CONSTANTS_2026_27.employerNiRate;
  const employerNiPassedThrough = employerNiSaved * employerNiPassThrough;
  const totalPensionPotBoost = bonusSacrificed + employerNiPassedThrough;

  // 6. Tax trap detection
  const enters60PercentTrap = (baseSalary < UK_TAX_CONSTANTS_2026_27.higherRateLimit && (baseSalary + bonusGross) > UK_TAX_CONSTANTS_2026_27.paTaperThreshold);
  const trapExposureAmount = Math.max(0, Math.min(UK_TAX_CONSTANTS_2026_27.higherRateLimit, baseSalary + bonusCashGross) - Math.max(UK_TAX_CONSTANTS_2026_27.paTaperThreshold, baseSalary));

  return {
    baseSalary,
    bonusGross,
    bonusSacrificed,
    bonusCashGross,
    bonusIncomeTax,
    bonusNi,
    bonusStudentLoan,
    bonusPostgradLoan,
    totalBonusDeductions,
    netBonusTakeHome,
    effectiveMarginalTaxRate: Number(effectiveMarginalTaxRate.toFixed(1)),
    employerNiPassedThrough,
    totalPensionPotBoost,
    enters60PercentTrap,
    trapExposureAmount
  };
}

export function calcUkBonusSacrifice(params) {
  const baseSalary = Math.max(0, parseFloat(params.baseSalary) || 85000);
  const bonusGross = Math.max(0, parseFloat(params.bonusGross || params.bonusAmount) || 20000);
  const sacrificePercent = Math.max(0, Math.min(100, parseFloat(params.sacrificePercent) || 0));
  const studentLoanPlan = params.studentLoanPlan || 'plan2';
  const hasPostgradLoan = Boolean(params.hasPostgradLoan);
  let employerNiPassThrough = 0;
  if (params.passThroughEmployerNi === true) {
    employerNiPassThrough = 1.0;
  } else if (params.employerNiPassThrough !== undefined) {
    employerNiPassThrough = Math.max(0, Math.min(100, parseFloat(params.employerNiPassThrough) || 0)) / 100.0;
  }

  const baseRes = calcBonusTaxNiSacrifice({
    baseSalary,
    bonusGross,
    sacrificePercent,
    studentLoanPlan,
    hasPostgradLoan,
    employerNiPassThrough: employerNiPassThrough * 100
  });

  const cashRes = calcBonusTaxNiSacrifice({
    baseSalary,
    bonusGross,
    sacrificePercent: 0,
    studentLoanPlan,
    hasPostgradLoan,
    employerNiPassThrough: 0
  });

  const pensionRes = calcBonusTaxNiSacrifice({
    baseSalary,
    bonusGross,
    sacrificePercent: 100,
    studentLoanPlan,
    hasPostgradLoan,
    employerNiPassThrough: employerNiPassThrough * 100
  });

  return {
    ...baseRes,
    cashOption: {
      bonusAmount: bonusGross,
      incomeTaxOnBonus: cashRes.bonusIncomeTax,
      niOnBonus: cashRes.bonusNi,
      studentLoanOnBonus: cashRes.bonusStudentLoan,
      postgradLoanOnBonus: cashRes.bonusPostgradLoan,
      totalDeductions: cashRes.totalBonusDeductions,
      netCashKept: cashRes.netBonusTakeHome,
      effectiveMarginalRate: cashRes.effectiveMarginalTaxRate
    },
    pensionOption: {
      bonusSacrificed: bonusGross,
      employerNiAdded: pensionRes.employerNiPassedThrough,
      totalPensionContribution: pensionRes.totalPensionPotBoost
    },
    effectiveReliefRate: cashRes.effectiveMarginalTaxRate
  };
}
