/**
 * 2026년 상속세 일괄공제(5억), 배우자공제(5~30억), 금융재산공제(최대 2억) 및 3% 신고세액공제 계산 모델
 */

export function calculateInheritanceTax2026(params) {
  const totalEstate = Math.max(0, Number(params.totalEstate) || 0);           // 총 상속재산가액 (부동산+금융+기타, 원)
  const debtsAndExpenses = Math.max(0, Number(params.debtsAndExpenses) || 0); // 공과금, 채무, 장례비용(기본 500만 이상) 합계 (원)
  const netFinancialAssets = Math.max(0, Number(params.netFinancialAssets) || 0); // 순금융재산 (예금/주식 - 금융채무, 원)
  
  const hasSpouse = Boolean(params.hasSpouse);                                // 배우자 생존 여부
  const isSpouseSoleHeir = Boolean(params.isSpouseSoleHeir);                  // 배우자 단독 상속 여부 (자녀 없음)
  const childrenCount = Math.max(0, Math.floor(Number(params.childrenCount)) || 0); // 자녀 수
  const actualSpouseInherited = Math.max(0, Number(params.actualSpouseInherited) || 0); // 배우자 실제 상속받은 금액 (원)

  // 1. 순상속재산가액 (과세가액)
  const netEstate = Math.max(0, totalEstate - debtsAndExpenses);

  // 2. 인적공제 vs 일괄공제 (상증세법 제21조, 제24조)
  // - 기초공제: 2억 원
  // - 기타인적공제: 자녀 1인당 5천만 원 등
  // - 일괄공제: 5억 원
  // * 핵심 법정 규정: 배우자 단독상속 시에는 일괄공제(5억) 적용 불가! (기초공제 2억 + 인적공제만 적용)
  const basicDeduction = 200000000;
  const childDeduction = childrenCount * 50000000;
  const itemizedHumanDeduction = basicDeduction + childDeduction;

  let generalDeduction = 0;
  let isLumpSumDisallowed = false;
  let deductionMethod = "";

  if (isSpouseSoleHeir) {
    // 배우자 단독 상속 시 일괄공제 5억 불가 -> 기초공제 2억만 적용
    generalDeduction = basicDeduction;
    isLumpSumDisallowed = true;
    deductionMethod = "기초공제 2억 원 (배우자 단독상속으로 일괄공제 5억 배제)";
  } else {
    // 자녀가 있거나 공동상속: 일괄공제(5억) vs 기초+기타인적공제 중 큰 금액
    if (itemizedHumanDeduction > 500000000) {
      generalDeduction = itemizedHumanDeduction;
      deductionMethod = `기초+인적공제 합계 (${itemizedHumanDeduction.toLocaleString()}원)`;
    } else {
      generalDeduction = 500000000;
      deductionMethod = "일괄공제 5억 원 (기초+인적공제보다 유리)";
    }
  }

  // 3. 배우자 상속공제 (상증세법 제19조)
  // - 최소 5억 원 보장 (배우자가 실제 상속받은 금액이 없거나 5억 미만이어도 5억 공제)
  // - 최대 30억 원 한도
  // - 한도액: min(실제상속액, 법정상속지분액, 30억)
  let spouseDeduction = 0;
  if (hasSpouse) {
    if (actualSpouseInherited <= 500000000) {
      spouseDeduction = 500000000; // 법정 최소 보장
    } else {
      // 법정 지분 계산: 배우자 1.5, 자녀 각 1.0
      const totalShares = 1.5 + (childrenCount > 0 ? childrenCount * 1.0 : 0);
      const spouseStatutoryShare = (1.5 / totalShares) * netEstate;
      const eligibleSpouseDeduction = Math.min(actualSpouseInherited, spouseStatutoryShare);
      spouseDeduction = Math.min(3000000000, Math.max(500000000, eligibleSpouseDeduction));
    }
  }

  // 4. 금융재산 상속공제 (상증세법 제22조)
  // - 2,000만 원 이하: 순금융재산 전액
  // - 2,000만 원 초과 ~ 1억 원 이하: 2,000만 원
  // - 1억 원 초과 ~ 10억 원 이하: 순금융재산의 20%
  // - 10억 원 초과: 최대 2억 원 한도
  let financialDeduction = 0;
  if (netFinancialAssets <= 20000000) {
    financialDeduction = netFinancialAssets;
  } else if (netFinancialAssets <= 100000000) {
    financialDeduction = 20000000;
  } else if (netFinancialAssets <= 1000000000) {
    financialDeduction = Math.round(netFinancialAssets * 0.20);
  } else {
    financialDeduction = 200000000; // 최대 2억
  }

  // 5. 총 상속공제액 및 과세표준
  const totalDeductions = generalDeduction + spouseDeduction + financialDeduction;
  const taxBase = Math.max(0, netEstate - totalDeductions);

  // 6. 5단계 누진세율 적용 (상증세법 제26조)
  let calculatedTax = 0;
  if (taxBase <= 100000000) {
    calculatedTax = taxBase * 0.10;
  } else if (taxBase <= 500000000) {
    calculatedTax = 10000000 + (taxBase - 100000000) * 0.20;
  } else if (taxBase <= 1000000000) {
    calculatedTax = 90000000 + (taxBase - 500000000) * 0.30;
  } else if (taxBase <= 3000000000) {
    calculatedTax = 240000000 + (taxBase - 1000000000) * 0.40;
  } else {
    calculatedTax = 1040000000 + (taxBase - 3000000000) * 0.50;
  }
  calculatedTax = Math.round(calculatedTax);

  // 7. 자진신고 세액공제 (3%)
  const reportCredit = Math.round(calculatedTax * 0.03);
  const finalInheritanceTax = Math.max(0, calculatedTax - reportCredit);

  // 10억 원 이하 기본 비과세 여부 (배우자 + 자녀 상속 시 일괄 5억 + 배우자 5억 = 10억 비과세)
  const isZeroTax = finalInheritanceTax === 0;

  return {
    totalEstate,
    debtsAndExpenses,
    netEstate,
    generalDeduction,
    isLumpSumDisallowed,
    deductionMethod,
    spouseDeduction,
    financialDeduction,
    totalDeductions,
    taxBase,
    calculatedTax,
    reportCredit,
    finalInheritanceTax,
    isZeroTax
  };
}
