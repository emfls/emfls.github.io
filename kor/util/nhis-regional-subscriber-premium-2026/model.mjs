/**
 * 2026년 국민건강보험 지역가입자 보험료 계산 및 임의계속가입 비교 모델
 */

export function calculateRegionalNhis2026(params) {
  const annualBusinessIncome = Math.max(0, Number(params.annualBusinessIncome) || 0);   // 사업/기타소득 (100% 반영)
  const annualSalaryPensionIncome = Math.max(0, Number(params.annualSalaryPensionIncome) || 0); // 근로/공적연금소득 (50% 반영)
  const annualFinancialIncome = Math.max(0, Number(params.annualFinancialIncome) || 0); // 이자/배당소득 (1천만 초과 시 100%)
  const propertyTaxBase = Math.max(0, Number(params.propertyTaxBase) || 0);             // 주택/토지 재산세 과세표준 (원)
  const jeonseDeposit = Math.max(0, Number(params.jeonseDeposit) || 0);                 // 전월세 보증금 (원, 30% 반영)
  const previousWorkplacePremium = Math.max(0, Number(params.previousWorkplacePremium) || 0); // 이전 직장 건강보험료 (임의계속 비교용)

  // 1. 소득보험료 산정 (소득정률제 7.19%)
  // 금융소득: 1,000만 원 이하는 0원 반영, 1,000만 원 초과 시 전액 100% 반영
  let financialCounted = 0;
  if (annualFinancialIncome > 10000000) {
    financialCounted = annualFinancialIncome;
  }

  // 총 부과 대상 연소득
  const countedAnnualIncome = annualBusinessIncome + Math.floor(annualSalaryPensionIncome * 0.50) + financialCounted;
  
  // 월 소득보험료 = (연소득 / 12) * 7.19%
  const nhisRate = 0.0719; // 2026 확정 건보료율
  let monthlyIncomeNhis = Math.floor((countedAnnualIncome / 12) * nhisRate);
  
  // 최저보험료 하한 적용 (2026년 월 19,780원)
  const minPremiumFloor = 19780;
  const isFloorApplied = monthlyIncomeNhis < minPremiumFloor && countedAnnualIncome > 0;
  if (monthlyIncomeNhis < minPremiumFloor && countedAnnualIncome > 0) {
    monthlyIncomeNhis = minPremiumFloor;
  }

  // 2. 재산보험료 산정 (점수제, 2026년 점수당 211.5원)
  // 전월세 보증금의 30%를 재산세 과표로 합산
  const jeonseTaxBase = Math.floor(jeonseDeposit * 0.30);
  const totalRawPropertyBase = propertyTaxBase + jeonseTaxBase;

  // 2026년 재산세 과표 기본공제 1억 원 (100,000,000원)
  const netPropertyBase = Math.max(0, totalRawPropertyBase - 100000000);

  // 60등급 재산점수표 (국민건강보험법 시행령 별표 4) 구간별 점수 산정
  function getPropertyPoints(base) {
    if (base <= 0) return 0;
    if (base <= 4500000) return 22;
    if (base <= 10000000) return Math.floor(22 + ((base - 4500000) / 5500000) * 24); // ~46
    if (base <= 20000000) return Math.floor(46 + ((base - 10000000) / 10000000) * 51); // ~97
    if (base <= 50000000) return Math.floor(97 + ((base - 20000000) / 30000000) * 108); // ~205
    if (base <= 100000000) return Math.floor(205 + ((base - 50000000) / 50000000) * 129); // ~334
    if (base <= 200000000) return Math.floor(334 + ((base - 100000000) / 100000000) * 178); // ~512
    if (base <= 300000000) return Math.floor(512 + ((base - 200000000) / 100000000) * 139); // ~651
    if (base <= 500000000) return Math.floor(651 + ((base - 300000000) / 200000000) * 204); // ~855
    if (base <= 750000000) return Math.floor(855 + ((base - 500000000) / 250000000) * 218); // ~1073
    if (base <= 1000000000) return Math.floor(1073 + ((base - 750000000) / 250000000) * 207); // ~1280
    if (base <= 1500000000) return Math.floor(1280 + ((base - 1000000000) / 500000000) * 290); // ~1570
    if (base <= 2000000000) return Math.floor(1570 + ((base - 1500000000) / 500000000) * 200); // ~1770
    return Math.min(2011, Math.floor(1770 + ((base - 2000000000) / 1000000000) * 241));
  }

  const propertyPoints = getPropertyPoints(netPropertyBase);
  const pointRate = 211.5; // 2026년 확정 부과점수당 금액
  const monthlyPropertyNhis = Math.floor(propertyPoints * pointRate);

  // 3. 자동차 보험료: 0원 (2024년 2월 전면 폐지 확인)
  const monthlyCarNhis = 0;

  // 4. 월 건강보험료 합계 & 장기요양보험료 (건보료의 13.14%)
  const monthlyNhisSubtotal = monthlyIncomeNhis + monthlyPropertyNhis + monthlyCarNhis;
  const ltcRate = 0.1314; // 2026 장기요양보험료율
  const monthlyLtc = Math.floor(monthlyNhisSubtotal * ltcRate);

  // 5. 월 총 건강보험료 (건보 + 장기요양)
  const monthlyTotalPremium = monthlyNhisSubtotal + monthlyLtc;
  const annualTotalPremium = monthlyTotalPremium * 12;

  // 6. 퇴직자 임의계속가입제도 비교 (최대 36개월)
  let monthlyVoluntarySaving = 0;
  let total36MonthSaving = 0;
  let isVoluntaryAdvantageous = false;

  if (previousWorkplacePremium > 0) {
    if (monthlyTotalPremium > previousWorkplacePremium) {
      isVoluntaryAdvantageous = true;
      monthlyVoluntarySaving = monthlyTotalPremium - previousWorkplacePremium;
      total36MonthSaving = monthlyVoluntarySaving * 36;
    }
  }

  return {
    annualBusinessIncome,
    annualSalaryPensionIncome,
    annualFinancialIncome,
    financialCounted,
    countedAnnualIncome,
    monthlyIncomeNhis,
    minPremiumFloor,
    isFloorApplied,
    propertyTaxBase,
    jeonseDeposit,
    jeonseTaxBase,
    totalRawPropertyBase,
    netPropertyBase,
    propertyPoints,
    pointRate,
    monthlyPropertyNhis,
    monthlyCarNhis,
    monthlyNhisSubtotal,
    monthlyLtc,
    monthlyTotalPremium,
    annualTotalPremium,
    previousWorkplacePremium,
    isVoluntaryAdvantageous,
    monthlyVoluntarySaving,
    total36MonthSaving
  };
}
