/**
 * Tool 493: 2026년 근로장려금 및 자녀장려금 계산기
 * Pure deterministic ESM module.
 */

export const EITC_LIMITS = {
  single: { incomeLimit: 22000000, maxAmount: 1650000, incThresh: 4000000, decThresh: 9000000 },
  singleEarner: { incomeLimit: 32000000, maxAmount: 2850000, incThresh: 7000000, decThresh: 14000000 },
  dualEarner: { incomeLimit: 44000000, maxAmount: 3300000, incThresh: 8000000, decThresh: 17000000 }
};

export const CTC_INCOME_LIMIT = 70000000;  // 7,000만 원 미만
export const CTC_MAX_PER_CHILD = 1000000;  // 자녀 1인당 최대 100만 원
export const ASSET_REDUCTION_MIN = 170000000; // 1억 7천만 원 (50% 감액 시작)
export const ASSET_CUTOFF = 240000000;        // 2억 4천만 원 (지급 제외)

/**
 * 근로장려금 산정액 계산
 */
export function calcEitcAmount(householdType, income) {
  const conf = EITC_LIMITS[householdType];
  if (!conf || income <= 0 || income >= conf.incomeLimit) return 0;

  if (income <= conf.incThresh) {
    // 점증구간
    return Math.round(income * (conf.maxAmount / conf.incThresh));
  } else if (income <= conf.decThresh) {
    // 평탄구간 (최대지급액)
    return conf.maxAmount;
  } else {
    // 점감구간
    const decRange = conf.incomeLimit - conf.decThresh;
    const excess = income - conf.decThresh;
    const amount = conf.maxAmount - Math.round(excess * (conf.maxAmount / decRange));
    return Math.max(0, amount);
  }
}

/**
 * 자녀장려금 산정액 계산
 */
export function calcCtcAmount(householdType, income, childCount) {
  if (childCount <= 0 || householdType === 'single' || income <= 0 || income >= CTC_INCOME_LIMIT) {
    return 0;
  }
  const maxTotalCtc = childCount * CTC_MAX_PER_CHILD;
  if (income <= 21000000) {
    return maxTotalCtc;
  }
  // 2,100만 초과 시 점감 산식
  const decRange = CTC_INCOME_LIMIT - 21000000;
  const excess = income - 21000000;
  const reductionPerChild = (excess / decRange) * (CTC_MAX_PER_CHILD - 500000); // 최소 50만원 보장선
  const amountPerChild = Math.max(500000, Math.round(CTC_MAX_PER_CHILD - reductionPerChild));
  return amountPerChild * childCount;
}

/**
 * 통합 근로장려금 & 자녀장려금 계산기
 */
export function calcEarnedIncomeChildTaxCredit(params) {
  const householdType = params.householdType || 'dualEarner';
  const income = Math.max(0, Number(params.income) || 0);
  const totalAssets = Math.max(0, Number(params.totalAssets) || 0);
  const childCount = Math.max(0, Number(params.childCount) || 0);

  // 1. 기초 산정액
  const rawEitc = calcEitcAmount(householdType, income);
  const rawCtc = calcCtcAmount(householdType, income, childCount);

  // 2. 재산 기준 판정
  let assetMultiplier = 1.0;
  let assetStatus = 'NORMAL'; // NORMAL, REDUCED_50, INELIGIBLE

  if (totalAssets >= ASSET_CUTOFF) {
    assetMultiplier = 0.0;
    assetStatus = 'INELIGIBLE';
  } else if (totalAssets >= ASSET_REDUCTION_MIN) {
    assetMultiplier = 0.5;
    assetStatus = 'REDUCED_50';
  }

  // 3. 최종 지급액
  const finalEitc = Math.round(rawEitc * assetMultiplier);
  const finalCtc = Math.round(rawCtc * assetMultiplier);
  const totalPayment = finalEitc + finalCtc;

  // 4. 자격 상태
  const isEitcEligible = finalEitc > 0;
  const isCtcEligible = finalCtc > 0;

  return {
    householdType,
    income,
    totalAssets,
    childCount,
    rawEitc,
    rawCtc,
    assetMultiplier,
    assetStatus,
    finalEitc,
    finalCtc,
    totalPayment,
    isEitcEligible,
    isCtcEligible
  };
}
