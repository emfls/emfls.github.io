/**
 * 2026년 국민건강보험 피부양자 탈락 판정 및 지역가입자 보험료 추정 모델
 */

export function calculateNhisDependentStatus(params) {
  const financialIncome = Math.max(0, Number(params.financialIncome) || 0); // 이자/배당
  const businessIncome = Math.max(0, Number(params.businessIncome) || 0);   // 사업소득
  const hasBusinessReg = Boolean(params.hasBusinessReg);                    // 사업자등록 여부
  const earnedIncome = Math.max(0, Number(params.earnedIncome) || 0);       // 근로소득
  const publicPension = Math.max(0, Number(params.publicPension) || 0);     // 국민/공무원/사학/군인연금
  const otherIncome = Math.max(0, Number(params.otherIncome) || 0);         // 기타소득
  const propertyTaxBase = Math.max(0, Number(params.propertyTaxBase) || 0); // 재산세 과세표준
  const isMarried = Boolean(params.isMarried);                              // 기혼 여부
  const spouseFailed = Boolean(params.spouseFailed);                        // 배우자 탈락 여부

  // 1. 금융소득 1,000만 원 함정 평가
  // 1,000만 원 이하: 합산소득에 0원 반영 (비합산)
  // 1,000만 원 초과: 전액 합산
  const countedFinancialIncome = financialIncome > 10000000 ? financialIncome : 0;
  const isFinancialTrap = financialIncome > 10000000;

  // 2. 사업소득 판정
  // 등록 사업자: 1원이라도 소득 있으면 탈락 (사업소득금액 > 0)
  // 미등록 프리랜서: 연 500만 원 초과 시 탈락
  let businessDisqualified = false;
  let businessReason = "";
  if (hasBusinessReg && businessIncome > 0) {
    businessDisqualified = true;
    businessReason = "사업자등록 보유 상태에서 사업소득 1원 이상 발생 (즉시 탈락)";
  } else if (!hasBusinessReg && businessIncome > 5000000) {
    businessDisqualified = true;
    businessReason = "미등록 사업소득(프리랜서 등) 500만 원 초과 (탈락)";
  }

  // 3. 연간 합산소득 계산
  // 합산소득 = 금융(1000만 초과분 전액) + 사업 + 근로 + 공적연금 + 기타
  const totalCountedIncome = countedFinancialIncome + businessIncome + earnedIncome + publicPension + otherIncome;
  const incomeDisqualified = totalCountedIncome > 20000000;

  // 4. 재산 과세표준 판정
  // 과표 9억 초과: 무조건 탈락
  // 과표 5.4억 초과 ~ 9억 이하: 합산소득 1,000만 원 초과 시 탈락
  // 과표 5.4억 이하: 소득 2,000만 이하 유지 시 가능
  let propertyDisqualified = false;
  let propertyReason = "";
  if (propertyTaxBase > 900000000) {
    propertyDisqualified = true;
    propertyReason = "재산세 과세표준 9억 원 초과 (소득 무관 무조건 탈락)";
  } else if (propertyTaxBase > 540000000) {
    if (totalCountedIncome > 10000000) {
      propertyDisqualified = true;
      propertyReason = "재산 과표 5.4억~9억 구간에서 연간 합산소득 1,000만 원 초과 (탈락)";
    }
  }

  // 5. 부부 동반 탈락 여부
  let spouseDisqualified = false;
  if (isMarried && spouseFailed) {
    spouseDisqualified = true;
  }

  // 최종 자격 판정
  const disqualified = businessDisqualified || incomeDisqualified || propertyDisqualified || spouseDisqualified;
  const isPass = !disqualified;

  // 탈락 사유 목록
  const disqualificationReasons = [];
  if (businessDisqualified) disqualificationReasons.push(businessReason);
  if (incomeDisqualified) disqualificationReasons.push(`연간 합산소득 2,000만 원 초과 (${Math.round(totalCountedIncome).toLocaleString()}원)`);
  if (propertyDisqualified) disqualificationReasons.push(propertyReason);
  if (spouseDisqualified) disqualificationReasons.push("기혼 배우자의 소득/재산 기준 미달로 인한 부부 동반 탈락");

  // 6. 지역가입자 전환 시 월 건강보험료 추산
  // (소득 부과: 7.09%, 재산 기본공제 1억 원 적용)
  let estimatedMonthlyIncomeNhis = 0;
  if (disqualified) {
    // 소득보험료: 전체 연간소득(전체 금융소득 포함) * 7.09% / 12
    const totalActualIncome = financialIncome + businessIncome + earnedIncome + publicPension + otherIncome;
    estimatedMonthlyIncomeNhis = Math.round((totalActualIncome * 0.0709) / 12);
  }

  let estimatedMonthlyPropertyNhis = 0;
  if (disqualified && propertyTaxBase > 0) {
    // 2024년 2월 이후 재산 기본공제 1억 원 차감
    const taxableProperty = Math.max(0, propertyTaxBase - 100000000);
    if (taxableProperty > 0) {
      // 대략적인 재산보험료 점수제 환산 (과표 구간별 약 0.12%~0.18% 수준)
      estimatedMonthlyPropertyNhis = Math.round((taxableProperty * 0.0014) / 12);
    }
  }

  const baseMonthlyNhis = estimatedMonthlyIncomeNhis + estimatedMonthlyPropertyNhis;
  // 장기요양보험료 (건보료의 12.95%)
  const monthlyLongTermCare = Math.round(baseMonthlyNhis * 0.1295);
  const totalMonthlyNhis = disqualified ? Math.max(19780, baseMonthlyNhis + monthlyLongTermCare) : 0; // 최저보험료 19,780원 적용
  const totalAnnualNhis = totalMonthlyNhis * 12;

  // ISA / 비과세 절세 방어 시나리오
  // 만약 금융소득이 1,000만 원을 초과하여 탈락한 경우, 1,000만 원 이하로 유지했을 때의 절감액
  let potentialSavings = 0;
  if (isFinancialTrap && totalCountedIncome > 20000000) {
    const incomeWithoutExcess = totalCountedIncome - financialIncome;
    if (incomeWithoutExcess <= 20000000 && !businessDisqualified && !propertyDisqualified) {
      potentialSavings = totalAnnualNhis;
    }
  }

  return {
    isPass,
    disqualified,
    disqualificationReasons,
    totalCountedIncome,
    isFinancialTrap,
    businessDisqualified,
    incomeDisqualified,
    propertyDisqualified,
    spouseDisqualified,
    estimatedMonthlyIncomeNhis,
    estimatedMonthlyPropertyNhis,
    monthlyLongTermCare,
    totalMonthlyNhis,
    totalAnnualNhis,
    potentialSavings
  };
}
