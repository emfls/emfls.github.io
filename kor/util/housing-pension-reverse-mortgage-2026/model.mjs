/**
 * 2026년 한국주택금융공사(HF) 주택연금 월지급금 및 총수령액 산정 모델
 * 2026.3.1 시행 개정 테이블 반영
 */

const PENSION_RATE_PER_100M = {
  55: 156000, 56: 165000, 57: 175000, 58: 186000, 59: 198000,
  60: 210600, 61: 218000, 62: 226000, 63: 234000, 64: 243000,
  65: 252800, 66: 263000, 67: 273000, 68: 284000, 69: 295000,
  70: 307800, 71: 322000, 72: 337000, 73: 353000, 74: 371000,
  75: 391000, 76: 412000, 77: 434000, 78: 457000, 79: 481000,
  80: 508000, 81: 540000, 82: 574000, 83: 611000, 84: 652000,
  85: 698000, 86: 749000, 87: 805000, 88: 868000, 89: 938000,
  90: 995000
};

export function getRateForAge(age) {
  if (age < 55) return PENSION_RATE_PER_100M[55];
  if (age >= 90) return PENSION_RATE_PER_100M[90];
  return PENSION_RATE_PER_100M[Math.floor(age)] || 252800;
}

export function calculateHousingPension2026(params) {
  const age = Math.max(50, Math.min(100, params.age !== undefined ? Number(params.age) || 65 : 65));
  const rawHousePrice = Math.max(0, params.housePrice !== undefined ? Number(params.housePrice) || 500000000 : 500000000);
  const payoutType = params.payoutType || "fixed"; // fixed (정액형), initial_growth (초기증액형)
  const targetAge = Math.max(age, Math.min(105, params.targetAge !== undefined ? Number(params.targetAge) || 85 : 85));

  // 공시가격 12억 원 상한 판정
  const isEligibleAge = age >= 55;
  const isPriceOverLimit = rawHousePrice > 1200000000;
  
  // 연금 산정 시세 상한은 최대 12억 원
  const effectivePrice = Math.min(1200000000, rawHousePrice);

  let qualificationErrors = [];
  if (!isEligibleAge) {
    qualificationErrors.push("부부 중 연소자 기준 만 55세 이상이어야 신청 가능합니다.");
  }

  const ratePer100M = getRateForAge(age);
  const baseMonthlyPayout = isEligibleAge ? Math.round((effectivePrice / 100000000) * ratePer100M) : 0;

  // 지급 방식별 계산
  let monthlyPayout = baseMonthlyPayout;
  if (payoutType === "initial_growth" && isEligibleAge) {
    // 초기 3년간 기본 대비 약 20% 증액
    monthlyPayout = Math.round(baseMonthlyPayout * 1.20);
  }

  // 총 수령액 (목표 연령까지)
  const yearsToTarget = Math.max(0, targetAge - age);
  const totalPayoutAtTarget = baseMonthlyPayout * yearsToTarget * 12;

  // 주요 연령별 누적 수령액 (80세, 85세, 90세, 95세)
  const cumulativeAt80 = age <= 80 ? baseMonthlyPayout * (80 - age) * 12 : 0;
  const cumulativeAt85 = age <= 85 ? baseMonthlyPayout * (85 - age) * 12 : 0;
  const cumulativeAt90 = age <= 90 ? baseMonthlyPayout * (90 - age) * 12 : 0;
  const cumulativeAt95 = age <= 95 ? baseMonthlyPayout * (95 - age) * 12 : 0;

  // 집값 대비 원금 회수(손익분기) 연령
  let breakevenMonths = baseMonthlyPayout > 0 ? Math.ceil(effectivePrice / baseMonthlyPayout) : 0;
  let breakevenAge = Number((age + (breakevenMonths / 12)).toFixed(1));

  return {
    age,
    rawHousePrice,
    effectivePrice,
    isEligibleAge,
    isPriceOverLimit,
    payoutType,
    targetAge,
    ratePer100M,
    baseMonthlyPayout,
    monthlyPayout,
    totalPayoutAtTarget,
    cumulativeAt80,
    cumulativeAt85,
    cumulativeAt90,
    cumulativeAt95,
    breakevenMonths,
    breakevenAge,
    qualificationErrors
  };
}
