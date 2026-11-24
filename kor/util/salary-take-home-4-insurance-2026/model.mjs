/**
 * 2026년 연봉 실수령액 및 2025 vs 2026 4대보험 인상 비교 모델
 */

export function calculateSalaryTakeHome2026(params) {
  const annualSalary = Math.max(0, Number(params.annualSalary) || 0);         // 연봉 (세전, 원)
  const nonTaxableMeal = params.nonTaxableMeal !== undefined ? Math.max(0, Number(params.nonTaxableMeal) || 0) : 200000; // 월 비과세 식대 (기본 20만 원)
  const dependentsCount = Math.max(1, Math.floor(Number(params.dependentsCount)) || 1); // 본인 포함 부양가족 수
  const childrenCount = Math.max(0, Math.floor(Number(params.childrenCount)) || 0);     // 8~20세 자녀 수

  const monthlyGross = Math.round(annualSalary / 12);
  const monthlyTaxable = Math.max(0, monthlyGross - nonTaxableMeal);

  // 1. 2026년 4대보험 요율 (근로자 부담분)
  // 국민연금: 9.5% (근로자 4.75%), 기준소득월액 상한 6,370,000원, 하한 400,000원
  const npsCap = 6370000;
  const npsFloor = 400000;
  const npsBase2026 = Math.min(npsCap, Math.max(npsFloor, monthlyTaxable));
  const monthlyNps2026 = Math.round(npsBase2026 * 0.0475);

  // 건강보험: 7.19% (근로자 3.595%, 2025년 3.545% 대비 +0.05%p)
  const monthlyNhi2026 = Math.round(monthlyTaxable * 0.03595);

  // 장기요양보험: 건강보험료의 13.14% (2025년 12.95% 대비 인상)
  const monthlyLtc2026 = Math.round(monthlyNhi2026 * 0.1314);

  // 고용보험: 0.9%
  const monthlyEi2026 = Math.round(monthlyTaxable * 0.009);

  const totalMonthlyInsurance2026 = monthlyNps2026 + monthlyNhi2026 + monthlyLtc2026 + monthlyEi2026;

  // 2. 근로소득세 및 지방소득세 근사 산출 (간이세액표 근사)
  // 과세표준 연 환산
  const annualTaxable = monthlyTaxable * 12;
  // 근로소득공제
  let earnedIncomeDeduction = 0;
  if (annualTaxable <= 5000000) {
    earnedIncomeDeduction = annualTaxable * 0.70;
  } else if (annualTaxable <= 15000000) {
    earnedIncomeDeduction = 3500000 + (annualTaxable - 5000000) * 0.40;
  } else if (annualTaxable <= 45000000) {
    earnedIncomeDeduction = 7500000 + (annualTaxable - 15000000) * 0.15;
  } else if (annualTaxable <= 100000000) {
    earnedIncomeDeduction = 12000000 + (annualTaxable - 45000000) * 0.05;
  } else {
    earnedIncomeDeduction = 14750000 + (annualTaxable - 100000000) * 0.02;
  }

  // 인적공제 (1인당 150만 원)
  const personalDeduction = dependentsCount * 1500000;
  // 4대보험 소득공제
  const insuranceDeduction = totalMonthlyInsurance2026 * 12;
  // 표준세액공제 기본 차감 (약 13만 원 또는 소득공제 종합)
  const approxTaxBase = Math.max(0, annualTaxable - earnedIncomeDeduction - personalDeduction - insuranceDeduction);

  // 산출세액 (기본세율)
  let calculatedIncomeTax = 0;
  if (approxTaxBase <= 14000000) {
    calculatedIncomeTax = approxTaxBase * 0.06;
  } else if (approxTaxBase <= 50000000) {
    calculatedIncomeTax = 840000 + (approxTaxBase - 14000000) * 0.15;
  } else if (approxTaxBase <= 88000000) {
    calculatedIncomeTax = 6240000 + (approxTaxBase - 50000000) * 0.24;
  } else if (approxTaxBase <= 150000000) {
    calculatedIncomeTax = 15360000 + (approxTaxBase - 88000000) * 0.35;
  } else if (approxTaxBase <= 300000000) {
    calculatedIncomeTax = 37060000 + (approxTaxBase - 150000000) * 0.38;
  } else {
    calculatedIncomeTax = 94060000 + (approxTaxBase - 300000000) * 0.40;
  }

  // 근로소득세액공제
  let earnedIncomeTaxCredit = 0;
  if (calculatedIncomeTax <= 1300000) {
    earnedIncomeTaxCredit = Math.min(740000, calculatedIncomeTax * 0.55);
  } else {
    earnedIncomeTaxCredit = Math.min(740000, 715000 + (calculatedIncomeTax - 1300000) * 0.30);
  }

  // 자녀세액공제 (1명 15만, 2명 35만, 3명 65만)
  let childCredit = 0;
  if (childrenCount === 1) childCredit = 150000;
  else if (childrenCount === 2) childCredit = 350000;
  else if (childrenCount >= 3) childCredit = 350000 + (childrenCount - 2) * 300000;

  const annualIncomeTax = Math.max(0, Math.round(calculatedIncomeTax - earnedIncomeTaxCredit - childCredit));
  const monthlyIncomeTax = Math.round(annualIncomeTax / 12);
  const monthlyLocalTax = Math.round(monthlyIncomeTax * 0.10);
  const totalMonthlyTax = monthlyIncomeTax + monthlyLocalTax;

  const totalMonthlyDeductions2026 = totalMonthlyInsurance2026 + totalMonthlyTax;
  const monthlyTakeHome2026 = Math.max(0, monthlyGross - totalMonthlyDeductions2026);
  const annualTakeHome2026 = monthlyTakeHome2026 * 12;

  // 3. 2025년 기준 비교 (국민연금 4.5%, 건보 3.545%, 요양 12.95%, 고용 0.9%)
  const npsCap2025 = 6170000;
  const npsBase2025 = Math.min(npsCap2025, Math.max(npsFloor, monthlyTaxable));
  const monthlyNps2025 = Math.round(npsBase2025 * 0.045);
  const monthlyNhi2025 = Math.round(monthlyTaxable * 0.03545);
  const monthlyLtc2025 = Math.round(monthlyNhi2025 * 0.1295);
  const monthlyEi2025 = Math.round(monthlyTaxable * 0.009);
  const totalMonthlyInsurance2025 = monthlyNps2025 + monthlyNhi2025 + monthlyLtc2025 + monthlyEi2025;
  const totalMonthlyDeductions2025 = totalMonthlyInsurance2025 + totalMonthlyTax;
  const monthlyTakeHome2025 = Math.max(0, monthlyGross - totalMonthlyDeductions2025);
  const annualTakeHome2025 = monthlyTakeHome2025 * 12;

  // 인상 차액
  const monthlyInsuranceIncrease = totalMonthlyInsurance2026 - totalMonthlyInsurance2025;
  const annualInsuranceIncrease = monthlyInsuranceIncrease * 12;
  const monthlyTakeHomeDiff = monthlyTakeHome2026 - monthlyTakeHome2025; // 음수: 실수령액 감소

  return {
    annualSalary,
    monthlyGross,
    monthlyTaxable,
    nonTaxableMeal,
    monthlyNps2026,
    monthlyNhi2026,
    monthlyLtc2026,
    monthlyEi2026,
    totalMonthlyInsurance2026,
    monthlyIncomeTax,
    monthlyLocalTax,
    totalMonthlyTax,
    totalMonthlyDeductions2026,
    monthlyTakeHome2026,
    annualTakeHome2026,
    monthlyNps2025,
    monthlyNhi2025,
    monthlyLtc2025,
    monthlyEi2025,
    totalMonthlyInsurance2025,
    monthlyTakeHome2025,
    annualTakeHome2025,
    monthlyInsuranceIncrease,
    annualInsuranceIncrease,
    monthlyTakeHomeDiff
  };
}
