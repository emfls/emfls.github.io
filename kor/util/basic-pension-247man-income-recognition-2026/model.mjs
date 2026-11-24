/**
 * Tool 494: 2026년 기초연금 소득인정액 및 모의계산기
 * Pure deterministic ESM module.
 */

export const THRESHOLD_SINGLE = 2470000;    // 단독가구 선정기준액 월 247만 원
export const THRESHOLD_COUPLE = 3952000;    // 부부가구 선정기준액 월 395만 2,000원
export const MAX_PENSION_SINGLE = 349700;   // 단독가구 최대지급액 월 349,700원
export const MAX_PENSION_COUPLE = 559520;   // 부부가구 최대지급액 월 559,520원 (부부 20% 감액)

export const WORK_INCOME_BASIC_DEDUCTION = 1160000; // 근로소득 기본공제 월 116만 원
export const WORK_INCOME_ADDITIONAL_RATE = 0.30;    // 초과분 30% 추가공제 (70%만 반영)

export const BASIC_ASSET_DEDUCTION = {
  metropolitan: 135000000, // 대도시 (특별·광역시 등): 1억 3,500만 원
  medium: 85000000,        // 중소도시 (도 및 세종 등): 8,500만 원
  rural: 72500000          // 농어촌 (군 지역): 7,250만 원
};

export const FINANCIAL_ASSET_DEDUCTION = 20000000; // 금융재산 기본공제 2,000만 원
export const ASSET_CONVERSION_RATE = 0.04;          // 재산의 소득환산율 연 4.0%

/**
 * 근로소득 평가액 계산
 */
export function calcWorkIncomeEvaluation(monthlyWorkIncome) {
  if (monthlyWorkIncome <= WORK_INCOME_BASIC_DEDUCTION) return 0;
  const excess = monthlyWorkIncome - WORK_INCOME_BASIC_DEDUCTION;
  return Math.round(excess * (1 - WORK_INCOME_ADDITIONAL_RATE));
}

/**
 * 재산의 월 소득환산액 계산
 */
export function calcAssetMonthlyConversion(params) {
  const region = params.region || 'metropolitan';
  const generalProperty = Math.max(0, Number(params.generalProperty) || 0);
  const financialAssets = Math.max(0, Number(params.financialAssets) || 0);
  const debts = Math.max(0, Number(params.debts) || 0);
  const luxuryAssets = Math.max(0, Number(params.luxuryAssets) || 0); // 4천만 이상 고급차/회원권 (월 100% 반영)

  const regionDeduction = BASIC_ASSET_DEDUCTION[region] || BASIC_ASSET_DEDUCTION.metropolitan;
  const netGeneral = Math.max(0, generalProperty - regionDeduction);
  const netFinancial = Math.max(0, financialAssets - FINANCIAL_ASSET_DEDUCTION);

  // 일반재산 + 금융재산 - 부채
  const totalNetProperty = Math.max(0, (netGeneral + netFinancial) - debts);
  const monthlyConversion = Math.round((totalNetProperty * ASSET_CONVERSION_RATE) / 12);

  // 사치성 재산은 월 100% 산입
  return monthlyConversion + luxuryAssets;
}

/**
 * 기초연금 소득인정액 및 예상 수급액 통합 산출
 */
export function calcBasicPension(params) {
  const isCouple = Boolean(params.isCouple);
  const monthlyWorkIncome = Math.max(0, Number(params.monthlyWorkIncome) || 0);
  const otherMonthlyIncome = Math.max(0, Number(params.otherMonthlyIncome) || 0); // 사업, 국민연금, 이자 등

  // 1. 소득평가액
  const workIncomeEval = calcWorkIncomeEvaluation(monthlyWorkIncome);
  const totalIncomeEval = workIncomeEval + otherMonthlyIncome;

  // 2. 재산의 소득환산액
  const assetMonthlyEval = calcAssetMonthlyConversion(params);

  // 3. 총 소득인정액
  const recognizedIncome = totalIncomeEval + assetMonthlyEval;

  // 4. 수급 자격 판정
  const threshold = isCouple ? THRESHOLD_COUPLE : THRESHOLD_SINGLE;
  const maxPension = isCouple ? MAX_PENSION_COUPLE : MAX_PENSION_SINGLE;
  const isEligible = recognizedIncome <= threshold;

  // 5. 소득역전방지 감액 산정
  let estimatedPension = 0;
  let isReduced = false;

  if (isEligible) {
    if (recognizedIncome + maxPension <= threshold) {
      estimatedPension = maxPension;
    } else {
      // 감액 지급: 기준선 - 소득인정액 (최소 10% 보장)
      const minGuarantee = Math.round(maxPension * 0.10);
      estimatedPension = Math.max(minGuarantee, threshold - recognizedIncome);
      isReduced = true;
    }
  }

  return {
    isCouple,
    monthlyWorkIncome,
    workIncomeEval,
    otherMonthlyIncome,
    totalIncomeEval,
    assetMonthlyEval,
    recognizedIncome,
    threshold,
    maxPension,
    isEligible,
    isReduced,
    estimatedPension
  };
}
