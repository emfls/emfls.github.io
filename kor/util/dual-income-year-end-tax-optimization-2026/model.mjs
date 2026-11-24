/**
 * Tool 501: 2026 맞벌이 부부 연말정산 최적화 시뮬레이터
 * Pure deterministic ESM module.
 */

// 2026 근로소득공제
export function calcEarnedIncomeDeduction(salary) {
  if (salary <= 0) return 0;
  if (salary <= 5000000) return salary * 0.7;
  if (salary <= 15000000) return 3500000 + (salary - 5000000) * 0.4;
  if (salary <= 45000000) return 7500000 + (salary - 15000000) * 0.15;
  if (salary <= 100000000) return 12000000 + (salary - 45000000) * 0.05;
  const ded = 14750000 + (salary - 100000000) * 0.02;
  return Math.min(20000000, ded);
}

// 2026 소득세 기본세율 (누진 과세표준)
export function calcIncomeTax(taxBase) {
  if (taxBase <= 0) return 0;
  let tax = 0;
  if (taxBase <= 14000000) {
    tax = taxBase * 0.06;
  } else if (taxBase <= 50000000) {
    tax = taxBase * 0.15 - 1260000;
  } else if (taxBase <= 88000000) {
    tax = taxBase * 0.24 - 5760000;
  } else if (taxBase <= 150000000) {
    tax = taxBase * 0.35 - 15440000;
  } else if (taxBase <= 300000000) {
    tax = taxBase * 0.38 - 19940000;
  } else if (taxBase <= 500000000) {
    tax = taxBase * 0.40 - 25940000;
  } else if (taxBase <= 1000000000) {
    tax = taxBase * 0.42 - 35940000;
  } else {
    tax = taxBase * 0.45 - 65940000;
  }
  return Math.max(0, Math.round(tax));
}

// 근로소득세액공제 (소득세법 제59조)
export function calcEarnedIncomeTaxCredit(calculatedTax, salary) {
  if (calculatedTax <= 0) return 0;
  let credit = 0;
  if (calculatedTax <= 1300000) {
    credit = calculatedTax * 0.55;
  } else {
    credit = 715000 + (calculatedTax - 1300000) * 0.30;
  }
  // 한도
  let limit = 740000;
  if (salary <= 33000000) {
    limit = 740000;
  } else if (salary <= 70000000) {
    limit = Math.max(660000, 740000 - (salary - 33000000) * 0.008);
  } else if (salary <= 120000000) {
    limit = Math.max(500000, 660000 - (salary - 70000000) * 0.5 * 0.008);
  } else {
    limit = Math.max(200000, 500000 - (salary - 120000000) * 0.5 * 0.008);
  }
  return Math.min(credit, limit, calculatedTax);
}

// 자녀세액공제 (1명 15만, 2명 35만, 3명 65만 + 30만/명)
export function calcChildTaxCredit(childCount) {
  if (childCount <= 0) return 0;
  if (childCount === 1) return 150000;
  if (childCount === 2) return 350000;
  return 650000 + (childCount - 3) * 300000;
}

// 의료비 세액공제 (총급여 3% 초과액의 15%, 한도 700만 원)
export function calcMedicalTaxCredit(salary, medicalExpense) {
  const threshold = salary * 0.03;
  if (medicalExpense <= threshold) return 0;
  const eligible = Math.min(7000000, medicalExpense - threshold);
  return Math.round(eligible * 0.15);
}

// 신용카드 소득공제 (총급여 25% 초과액의 15%~30% 블렌디드 약 20%, 한도 250만/300만)
export function calcCardDeduction(salary, cardSpend) {
  const threshold = salary * 0.25;
  if (cardSpend <= threshold) return 0;
  const eligible = cardSpend - threshold;
  const limit = salary <= 70000000 ? 3000000 : 2500000;
  return Math.min(limit, Math.round(eligible * 0.20));
}

// 단일 근로자 결정세액 산출
export function calcPersonTax({
  salary,
  dependentCount = 0,
  cardSpend = 0,
  medicalExpense = 0,
  educationExpense = 0,
  childCount = 0
}) {
  const earnedDed = calcEarnedIncomeDeduction(salary);
  const earnedIncome = Math.max(0, salary - earnedDed);

  // 인적공제: 본인(150만) + 부양가족(1인당 150만)
  const personalDed = 1500000 + dependentCount * 1500000;

  // 신용카드 소득공제
  const cardDed = calcCardDeduction(salary, cardSpend);

  // 과세표준
  const taxBase = Math.max(0, earnedIncome - personalDed - cardDed);

  // 산출세액
  const calcTax = calcIncomeTax(taxBase);

  // 세액공제: 근로소득세액공제 + 자녀세액공제 + 의료비(15%) + 교육비(15%)
  const earnedCredit = calcEarnedIncomeTaxCredit(calcTax, salary);
  const childCredit = calcChildTaxCredit(childCount);
  const medCredit = calcMedicalTaxCredit(salary, medicalExpense);
  const eduCredit = Math.round(Math.min(9000000, educationExpense) * 0.15);

  const totalCredits = earnedCredit + childCredit + medCredit + eduCredit;
  const finalTax = Math.max(0, calcTax - totalCredits);
  const finalTaxWithLocal = Math.round(finalTax * 1.1); // 지방소득세 10% 포함

  return {
    salary,
    earnedIncome,
    personalDed,
    cardDed,
    taxBase,
    calcTax,
    totalCredits,
    finalTax,
    finalTaxWithLocal
  };
}

// 맞벌이 가구 최적화 시뮬레이션
export function simulateDualIncome({
  salaryHusband,
  salaryWife,
  children = 0,
  parents = 0,
  medicalTotal = 0,
  cardHusband = 0,
  cardWife = 0,
  educationTotal = 0
}) {
  const higher = salaryHusband >= salaryWife ? "husband" : "wife";
  const totalDependents = children + parents;

  // 전략 1: 고소득자 전액 몰아주기 (모든 부양가족, 의료비, 교육비를 고소득자에게 배정)
  const plan1H = calcPersonTax({
    salary: salaryHusband,
    dependentCount: higher === "husband" ? totalDependents : 0,
    cardSpend: cardHusband,
    medicalExpense: higher === "husband" ? medicalTotal : 0,
    educationExpense: higher === "husband" ? educationTotal : 0,
    childCount: higher === "husband" ? children : 0
  });
  const plan1W = calcPersonTax({
    salary: salaryWife,
    dependentCount: higher === "wife" ? totalDependents : 0,
    cardSpend: cardWife,
    medicalExpense: higher === "wife" ? medicalTotal : 0,
    educationExpense: higher === "wife" ? educationTotal : 0,
    childCount: higher === "wife" ? children : 0
  });
  const totalTaxPlan1 = plan1H.finalTaxWithLocal + plan1W.finalTaxWithLocal;

  // 전략 2: 저소득자 의료비 집중 분산 (의료비는 3% 문턱 낮은 저소득자, 인적공제는 고소득자)
  const plan2H = calcPersonTax({
    salary: salaryHusband,
    dependentCount: higher === "husband" ? totalDependents : 0,
    cardSpend: cardHusband,
    medicalExpense: higher === "husband" ? 0 : medicalTotal,
    educationExpense: higher === "husband" ? educationTotal : 0,
    childCount: higher === "husband" ? children : 0
  });
  const plan2W = calcPersonTax({
    salary: salaryWife,
    dependentCount: higher === "wife" ? totalDependents : 0,
    cardSpend: cardWife,
    medicalExpense: higher === "wife" ? 0 : medicalTotal,
    educationExpense: higher === "wife" ? educationTotal : 0,
    childCount: higher === "wife" ? children : 0
  });
  const totalTaxPlan2 = plan2H.finalTaxWithLocal + plan2W.finalTaxWithLocal;

  // 최적 판정
  const bestPlan = totalTaxPlan2 < totalTaxPlan1 ? "PLAN_2_SPLIT" : "PLAN_1_CONCENTRATE";
  const minTax = Math.min(totalTaxPlan1, totalTaxPlan2);
  const maxTax = Math.max(totalTaxPlan1, totalTaxPlan2);
  const taxSavings = maxTax - minTax;

  return {
    higherEarner: higher,
    plan1: {
      name: "고소득자 일괄 몰아주기",
      taxHusband: plan1H.finalTaxWithLocal,
      taxWife: plan1W.finalTaxWithLocal,
      totalTax: totalTaxPlan1
    },
    plan2: {
      name: "의료비 저소득자 분산 전략",
      taxHusband: plan2H.finalTaxWithLocal,
      taxWife: plan2W.finalTaxWithLocal,
      totalTax: totalTaxPlan2
    },
    bestPlan,
    minTax,
    taxSavings
  };
}
