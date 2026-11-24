/**
 * Tool 477: 2026년 직장가입자 보수외소득월액 건강보험료 계산기
 * Pure deterministic ESM module.
 */

export const ANNUAL_EXEMPTION = 20000000;         // 연간 공제 기준금액: 2,000만 원
export const HEALTH_INSURANCE_RATE = 0.0719;       // 건강보험료율 7.19%
export const LONG_TERM_CARE_RATE = 0.1314;         // 장기요양보험료율 (건보료의 13.14%)
export const COMBINED_EFFECTIVE_RATE = 0.08134766; // 합산 실효 보험료율 (약 8.1348%)

/**
 * 보수외소득월액 건강보험료 계산
 * @param {Object} params
 * @param {number} params.interestIncome 이자소득 (원)
 * @param {number} params.dividendIncome 배당소득 (원)
 * @param {number} params.businessIncome 사업소득 (원, 부동산 임대 포함)
 * @param {number} params.otherIncome 기타소득/연금소득 (원)
 */
export function calcHealthInsuranceExtraIncome(params) {
  const interest = Math.max(0, parseFloat(params.interestIncome) || 0);
  const dividend = Math.max(0, parseFloat(params.dividendIncome) || 0);
  const business = Math.max(0, parseFloat(params.businessIncome) || 0);
  const other = Math.max(0, parseFloat(params.otherIncome) || 0);

  const totalExtraIncome = interest + dividend + business + other;

  // 연 2,000만 원 초과 여부 판정
  const isSurchargeApplicable = totalExtraIncome > ANNUAL_EXEMPTION;
  const annualExcessIncome = Math.max(0, totalExtraIncome - ANNUAL_EXEMPTION);

  // 소득월액 산정 (초과액 / 12)
  const monthlyExcessIncome = annualExcessIncome / 12;

  // 건보료 산정 (원 미만 절사, 본인 100% 전액 부담)
  const monthlyHealthInsurance = Math.floor(monthlyExcessIncome * HEALTH_INSURANCE_RATE);

  // 장기요양보험료 산정 (건보료의 13.14%, 원 미만 절사)
  const monthlyLongTermCare = Math.floor(monthlyHealthInsurance * LONG_TERM_CARE_RATE);

  // 월 총 추가 부담액 및 연간 총액
  const monthlyTotalSurcharge = monthlyHealthInsurance + monthlyLongTermCare;
  const annualTotalSurcharge = monthlyTotalSurcharge * 12;

  // 절세 팁: ISA/비과세 배당 분산 시 절감액 (배당 중 최대 2천만 원을 비과세로 전환 시)
  const potentialSavingsDividend = Math.min(dividend, annualExcessIncome);
  const potentialAnnualSavings = Math.floor((potentialSavingsDividend / 12) * HEALTH_INSURANCE_RATE * (1 + LONG_TERM_CARE_RATE) * 12);

  return {
    totalExtraIncome,
    isSurchargeApplicable,
    annualExcessIncome,
    monthlyExcessIncome: Math.round(monthlyExcessIncome),
    monthlyHealthInsurance,
    monthlyLongTermCare,
    monthlyTotalSurcharge,
    annualTotalSurcharge,
    potentialAnnualSavings
  };
}
