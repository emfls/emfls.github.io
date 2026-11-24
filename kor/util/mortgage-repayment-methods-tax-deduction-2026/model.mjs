/**
 * 2026년 주택담보대출 3대 상환방식(원리금균등, 원금균등, 체증식) 및 연말정산 장기주택저당차입금 소득공제 모델
 */

export function calculateMortgage2026(params) {
  const principal = Math.max(10000000, Number(params.principal) || 300000000); // 대출원금 (원, 기본 3억)
  const annualRate = Math.max(0.1, Math.min(20.0, Number(params.annualRate) || 4.2)); // 대출금리 (연 %)
  const termYears = Math.max(1, Math.min(50, Number(params.termYears) || 30));        // 대출기간 (년, 기본 30년)
  const marginalTaxRate = Number(params.marginalTaxRate) || 0.15;                     // 과표 한계세율 (기본 15% - 연봉 5~8천)
  const deductionType = params.deductionType || "fixed_non_grace_15y";                // 소득공제 상품유형
  const propertyBaseValue = Math.max(0, Number(params.propertyBaseValue) || 500000000); // 취득 당시 주택 기준시가 (6억 이하 요건)

  const n = termYears * 12; // 총 개월 수
  const r = annualRate / 100 / 12; // 월 이율

  // 1. [원리금균등분할상환] (Amortization)
  // PMT = P * r * (1+r)^n / ((1+r)^n - 1)
  const levelMonthlyPayment = Math.floor(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  const levelTotalPayment = levelMonthlyPayment * n;
  const levelTotalInterest = levelTotalPayment - principal;

  // 1년차(첫해) 이자 납부액 계산
  let levelYear1Interest = 0;
  let curBal = principal;
  for (let m = 1; m <= 12; m++) {
    const interest = Math.floor(curBal * r);
    levelYear1Interest += interest;
    curBal -= (levelMonthlyPayment - interest);
  }

  // 2. [원금균등분할상환] (Equal Principal)
  // 매월 원금 = P / n, k회차 이자 = 잔액 * r
  const monthlyPrincipal = Math.floor(principal / n);
  const equalPrincFirstMonth = monthlyPrincipal + Math.floor(principal * r);
  const equalPrincMidMonth = monthlyPrincipal + Math.floor((principal - monthlyPrincipal * (Math.floor(n / 2))) * r);
  const equalPrincLastMonth = monthlyPrincipal + Math.floor(monthlyPrincipal * r);

  // 총 이자 = P * r * (n + 1) / 2
  const equalPrincTotalInterest = Math.floor(principal * r * (n + 1) / 2);
  const equalPrincTotalPayment = principal + equalPrincTotalInterest;

  let equalPrincYear1Interest = 0;
  for (let m = 1; m <= 12; m++) {
    const bal = principal - monthlyPrincipal * (m - 1);
    equalPrincYear1Interest += Math.floor(bal * r);
  }

  // 3. [체증식분할상환] (Graduated Payment - 초기 적고 매년/매월 증가)
  // 보금자리론 체증식 근사: 초기 납입액은 대출이자 수준으로 시작하여 점증
  const graduatedFirstMonth = Math.floor(levelMonthlyPayment * 0.65);
  const graduatedMidMonth = levelMonthlyPayment;
  const graduatedLastMonth = Math.floor(levelMonthlyPayment * 1.55);
  // 체증식은 원금 상환이 늦어져 총 이자가 원리금균등보다 약 12~18% 더 많음
  const graduatedTotalInterest = Math.floor(levelTotalInterest * 1.15);
  const graduatedTotalPayment = principal + graduatedTotalInterest;
  const graduatedYear1Interest = Math.floor(principal * r * 12 * 0.98); // 첫해는 거의 이자만 상환

  // 4. [장기주택저당차입금 이자상환액 소득공제 (2026 소득세법 제52조)]
  // 취득 당시 기준시가 6억 원 이하 주택 요건
  const isEligibleProperty = propertyBaseValue <= 600000000;
  let deductionCap = 0;

  if (isEligibleProperty) {
    if (deductionType === "fixed_non_grace_15y") {
      deductionCap = 20000000; // 15년 이상 + 고정금리 & 비거치식 (최대 2,000만 원)
    } else if (deductionType === "fixed_or_non_grace_15y") {
      deductionCap = 15000000; // 15년 이상 + 고정금리 OR 비거치식 (1,500만 원)
    } else if (deductionType === "fixed_or_non_grace_10y") {
      deductionCap = 6000000;  // 10년 이상 15년 미만 + 고정금리 OR 비거치식 (600만 원)
    } else {
      deductionCap = 8000000;  // 15년 이상 기타 (변동금리 거치식 등 800만 원)
    }
  }

  // 원리금균등 첫해 이자 기준 공제액 산출
  const actualYear1Interest = levelYear1Interest;
  const qualifiedDeduction = isEligibleProperty ? Math.min(actualYear1Interest, deductionCap) : 0;
  // 소득세율 + 지방소득세 10%
  const effectiveTaxRate = marginalTaxRate * 1.10;
  const expectedTaxRefund = Math.floor(qualifiedDeduction * effectiveTaxRate);

  return {
    principal,
    annualRate,
    termYears,
    n,
    marginalTaxRate,
    deductionType,
    propertyBaseValue,
    isEligibleProperty,
    deductionCap,
    // 원리금균등
    levelMonthlyPayment,
    levelTotalInterest,
    levelTotalPayment,
    levelYear1Interest,
    // 원금균등
    equalPrincFirstMonth,
    equalPrincMidMonth,
    equalPrincLastMonth,
    equalPrincTotalInterest,
    equalPrincTotalPayment,
    equalPrincYear1Interest,
    // 체증식
    graduatedFirstMonth,
    graduatedMidMonth,
    graduatedLastMonth,
    graduatedTotalInterest,
    graduatedTotalPayment,
    // 이자 차액 (원금균등이 원리금균등보다 아끼는 총 이자)
    interestSavedByEqualPrinc: levelTotalInterest - equalPrincTotalInterest,
    // 연말정산 소득공제
    qualifiedDeduction,
    expectedTaxRefund
  };
}
