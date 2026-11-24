/**
 * Tool 479: 2026년 전세보증금 미반환 지연이자(법정 5% · 소송촉진특례법 연 12%) 계산기
 * Pure deterministic ESM module.
 */

export const CIVIL_LAW_RATE = 0.05;         // 민법 제379조 법정이율 연 5.0%
export const LITIGATION_LAW_RATE = 0.12;    // 소송촉진특례법 제3조 소송촉진이율 연 12.0%
export const DAYS_IN_YEAR = 365;

/**
 * 전세보증금 미반환 2단계 지연이자 계산
 * @param {Object} params
 * @param {number} params.depositAmount 전세보증금 (원)
 * @param {number} params.period1Days 1단계(명도일 ~ 소장 송달일) 경과 일수
 * @param {number} params.period2Days 2단계(소장 송달 익일 ~ 완제일) 경과 일수
 * @param {boolean} params.isEvicted 명도 및 열쇠 인도 완료 여부 (동시이행 해소)
 */
export function calcJeonseDelayInterest(params) {
  const deposit = Math.max(0, parseFloat(params.depositAmount) || 0);
  const days1 = Math.max(0, parseInt(params.period1Days, 10) || 0);
  const days2 = Math.max(0, parseInt(params.period2Days, 10) || 0);
  const isEvicted = params.isEvicted !== undefined ? Boolean(params.isEvicted) : true;

  // 1. 일일 지연손해금 (1일당 발생하는 금액)
  const dailyRate5pct = Math.floor(deposit * (CIVIL_LAW_RATE / DAYS_IN_YEAR));
  const dailyRate12pct = Math.floor(deposit * (LITIGATION_LAW_RATE / DAYS_IN_YEAR));

  // 2. 동시이행 관계 판정: 명도(열쇠 인도 또는 임차권등기 후 퇴거)가 되지 않았다면 지연이자 청구 불가
  let period1Interest = 0;
  let period2Interest = 0;

  if (isEvicted && deposit > 0) {
    // 1단계: 민법 5% 적용 기간
    period1Interest = Math.floor(deposit * CIVIL_LAW_RATE * (days1 / DAYS_IN_YEAR));

    // 2단계: 소송촉진특례법 12% 적용 기간
    period2Interest = Math.floor(deposit * LITIGATION_LAW_RATE * (days2 / DAYS_IN_YEAR));
  }

  const totalDelayInterest = period1Interest + period2Interest;
  const totalClaimAmount = deposit + totalDelayInterest;
  const totalDays = days1 + days2;

  // 월 환산 금액 (30일 기준)
  const monthlyRate5pct = dailyRate5pct * 30;
  const monthlyRate12pct = dailyRate12pct * 30;

  return {
    deposit,
    days1,
    days2,
    totalDays,
    isEvicted,
    dailyRate5pct,
    dailyRate12pct,
    monthlyRate5pct,
    monthlyRate12pct,
    period1Interest,
    period2Interest,
    totalDelayInterest,
    totalClaimAmount
  };
}
