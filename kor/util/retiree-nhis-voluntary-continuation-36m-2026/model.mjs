/**
 * Tool 504: 2026 퇴직자 건강보험 임의계속가입 vs 지역가입자 비교 계산기
 * Pure deterministic ESM module.
 */

export const NHIS_RATE_2026 = 0.0719;          // 2026 건보료율 7.19%
export const NHIS_WORKER_SHARE = 0.03595;       // 본인부담 3.595%
export const LONG_TERM_CARE_RATE = 0.1295;      // 장기요양 12.95%
export const REGIONAL_POINT_VALUE = 211.5;      // 부과점수당 211.5원
export const PROPERTY_BASIC_DEDUCTION = 100000000; // 재산 기본공제 1억 원

// 재산 과세표준(1억 공제 후) -> 재산 부과점수 환산
export function calcPropertyScore(netTaxBase) {
  if (netTaxBase <= 0) return 0;
  // 60등급 표준 환산 (간이 누진 구간)
  const valMil = netTaxBase / 1000000; // 백만 원 단위
  if (valMil <= 50) return Math.round(valMil * 2.2);
  if (valMil <= 100) return Math.round(110 + (valMil - 50) * 2.0);
  if (valMil <= 200) return Math.round(210 + (valMil - 100) * 1.8);
  if (valMil <= 400) return Math.round(390 + (valMil - 200) * 1.5);
  if (valMil <= 800) return Math.round(690 + (valMil - 400) * 1.2);
  if (valMil <= 1500) return Math.round(1170 + (valMil - 800) * 0.9);
  return Math.min(2340, Math.round(1800 + (valMil - 1500) * 0.6));
}

export function calcRetireeNhisComparison({
  priorMonthlySalary,
  realEstateTaxBase = 300000000,
  annualOtherIncome = 12000000,
  priorWorkMonths = 18
}) {
  // 1. 임의계속가입 자격 (퇴직 전 18개월 내 직장가입 통산 1년/12개월 이상)
  const isVoluntaryEligible = priorWorkMonths >= 12;

  // 2. 임의계속가입 월 보험료 (퇴직 전 직장 보수월액 기준)
  const volHealthMonthly = Math.round(priorMonthlySalary * NHIS_WORKER_SHARE);
  const volCareMonthly = Math.round(volHealthMonthly * LONG_TERM_CARE_RATE);
  const volTotalMonthly = volHealthMonthly + volCareMonthly;
  const volTotal36m = volTotalMonthly * 36;

  // 3. 지역가입자 월 보험료
  // (1) 소득 부과 (연 336만 초과 시 소득정률제 7.19%)
  let regIncomeMonthly = 0;
  if (annualOtherIncome > 3360000) {
    regIncomeMonthly = Math.round((annualOtherIncome / 12) * NHIS_RATE_2026);
  } else {
    regIncomeMonthly = 19780; // 최저보험료 수준
  }

  // (2) 재산 부과 (1억 원 기본공제 적용, 자동차는 0원)
  const netPropertyBase = Math.max(0, realEstateTaxBase - PROPERTY_BASIC_DEDUCTION);
  const propScore = calcPropertyScore(netPropertyBase);
  const regPropertyMonthly = Math.round(propScore * REGIONAL_POINT_VALUE);

  const regHealthMonthly = regIncomeMonthly + regPropertyMonthly;
  const regCareMonthly = Math.round(regHealthMonthly * LONG_TERM_CARE_RATE);
  const regTotalMonthly = regHealthMonthly + regCareMonthly;
  const regTotal36m = regTotalMonthly * 36;

  // 4. 피부양자 자격 판정
  // 소득 요건: 연간 합산소득 2,000만 원 이하
  // 재산 요건: 재산세 과표 5.4억 이하 (또는 5.4억~9억 & 연소득 1,000만 이하)
  let isDependentEligible = false;
  let dependentReason = "";

  if (annualOtherIncome > 20000000) {
    dependentReason = "연간 소득(2,000만 원 초과)으로 피부양자 등재 불가";
  } else if (realEstateTaxBase > 900000000) {
    dependentReason = "재산세 과세표준(9억 원 초과)으로 피부양자 등재 불가";
  } else if (realEstateTaxBase > 540000000 && annualOtherIncome > 10000000) {
    dependentReason = "재산 과표 5.4억 초과 상태에서 연소득 1,000만 원을 초과하여 탈락";
  } else {
    isDependentEligible = true;
    dependentReason = "가족 직장가입자의 피부양자로 등록 시 보험료 0원!";
  }

  // 5. 최적 선택 및 36개월 절감액
  let bestOption = "REGIONAL";
  let max36mSavings = 0;

  if (isDependentEligible) {
    bestOption = "DEPENDENT";
    max36mSavings = Math.min(volTotal36m, regTotal36m);
  } else if (isVoluntaryEligible && volTotalMonthly < regTotalMonthly) {
    bestOption = "VOLUNTARY";
    max36mSavings = regTotal36m - volTotal36m;
  } else {
    bestOption = "REGIONAL";
    max36mSavings = Math.max(0, volTotal36m - regTotal36m);
  }

  return {
    priorMonthlySalary,
    realEstateTaxBase,
    annualOtherIncome,
    isVoluntaryEligible,
    voluntary: {
      healthMonthly: volHealthMonthly,
      careMonthly: volCareMonthly,
      totalMonthly: volTotalMonthly,
      total36m: volTotal36m
    },
    regional: {
      incomeMonthly: regIncomeMonthly,
      propertyMonthly: regPropertyMonthly,
      healthMonthly: regHealthMonthly,
      careMonthly: regCareMonthly,
      totalMonthly: regTotalMonthly,
      total36m: regTotal36m
    },
    dependent: {
      eligible: isDependentEligible,
      reason: dependentReason
    },
    bestOption,
    monthlySavings: Math.abs(volTotalMonthly - regTotalMonthly),
    max36mSavings
  };
}
