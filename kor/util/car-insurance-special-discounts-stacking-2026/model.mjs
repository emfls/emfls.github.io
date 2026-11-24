/**
 * Tool 480: 2026년 자동차보험 5대 중복 할인 특약 총정리 계산기
 * Pure deterministic ESM module.
 */

export const DIRECT_DISCOUNT_RATE = 0.15; // 다이렉트 온라인 가입 할인율 15%

export const MILEAGE_RATES = {
  under_3k: 0.45,   // 연간 3,000km 이하: 45% 할인
  under_5k: 0.35,   // 연간 5,000km 이하: 35% 할인
  under_10k: 0.20,  // 연간 10,000km 이하: 20% 할인
  under_15k: 0.06,  // 연간 15,000km 이하: 6% 할인
  none: 0.00
};

export const UBI_RATES = {
  score_90plus: 0.27, // 티맵/카카오 90점 이상: 27% 할인
  score_81_90: 0.16,  // 티맵/카카오 81~90점: 16% 할인
  score_70_80: 0.10,  // 티맵/카카오 70~80점: 10% 할인
  none: 0.00
};

export const CHILD_RATES = {
  under_1: 0.14,  // 태아 또는 만 1세 이하: 14% 할인
  under_6: 0.08,  // 만 6세 이하: 8% 할인
  under_12: 0.05, // 만 12세 이하: 5% 할인
  none: 0.00
};

export const BLACKBOX_RATES = {
  builtin_cam: 0.07, // 현대/기아 순정 빌트인캠: 7% 할인
  blackbox: 0.04,    // 일반 장착형 블랙박스: 4% 할인
  none: 0.00
};

export const ADAS_RATES = {
  all_equipped: 0.13, // 차선이탈방지(LKAS) + 전방충돌방지(AEB) 동시 장착: 13% 할인
  aeb_only: 0.07,     // 전방충돌방지(AEB) 단독 장착: 7% 할인
  none: 0.00
};

/**
 * 5대 특약 연쇄 곱연산 할인 계산
 * @param {Object} params
 * @param {number} params.basePremium 기본 산출 보험료 (오프라인 설계사 기준, 원)
 * @param {boolean} params.isDirect 다이렉트 가입 여부 (기본 true)
 * @param {string} params.mileageTier 주행거리 구간 ('under_3k', 'under_5k', 'under_10k', 'under_15k', 'none')
 * @param {string} params.ubiTier 안전운전 UBI 구간 ('score_90plus', 'score_81_90', 'score_70_80', 'none')
 * @param {string} params.childTier 자녀 할인 구간 ('under_1', 'under_6', 'under_12', 'none')
 * @param {string} params.blackboxTier 블랙박스 유형 ('builtin_cam', 'blackbox', 'none')
 * @param {string} params.adasTier 첨단안전장치 유형 ('all_equipped', 'aeb_only', 'none')
 */
export function calcCarInsuranceDiscounts(params) {
  const base = Math.max(0, parseFloat(params.basePremium) || 0);
  const isDirect = params.isDirect !== undefined ? Boolean(params.isDirect) : true;

  const rDirect = isDirect ? DIRECT_DISCOUNT_RATE : 0.0;
  const rMileage = MILEAGE_RATES[params.mileageTier] || 0.0;
  const rUbi = UBI_RATES[params.ubiTier] || 0.0;
  const rChild = CHILD_RATES[params.childTier] || 0.0;
  const rBbox = BLACKBOX_RATES[params.blackboxTier] || 0.0;
  const rAdas = ADAS_RATES[params.adasTier] || 0.0;

  // 보험사 표준 연쇄 곱연산: Base * (1 - r1) * (1 - r2) * ...
  const compoundMultiplier = (1 - rDirect) * 
    (1 - rMileage) * 
    (1 - rUbi) * 
    (1 - rChild) * 
    (1 - rBbox) * 
    (1 - rAdas);

  const finalDiscountedPremium = Math.round(base * compoundMultiplier);
  const totalAnnualSavings = Math.max(0, base - finalDiscountedPremium);
  const totalDiscountPercent = base > 0 
    ? Math.round((totalAnnualSavings / base) * 100) 
    : 0;

  return {
    basePremium: base,
    isDirect,
    rDirect,
    rMileage,
    rUbi,
    rChild,
    rBbox,
    rAdas,
    compoundMultiplier: Number(compoundMultiplier.toFixed(4)),
    finalDiscountedPremium,
    totalAnnualSavings,
    totalDiscountPercent
  };
}
