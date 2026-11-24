/**
 * Tool 476: 2026년 전세자금대출 갈아타기 대환대출 3대 자격 판정 & 순이자 절감액 계산기
 * Pure deterministic ESM module.
 */

export const MIN_ELAPSED_MONTHS = 3; // 신규 대출 후 최소 3개월 경과 필요
export const MAX_PREPAYMENT_PENALTY_RATE = 0.006; // 전세대출 표준 최고 중도상환수수료율 0.6%
export const PREPAYMENT_PERIOD_MONTHS = 36; // 3년 슬라이딩 감소

/**
 * 인지세 계산 (대출자 50% 부담분)
 * @param {number} loanAmount 대출 원금 (원)
 */
export function calcStampDutyBorrowerShare(loanAmount) {
  if (loanAmount <= 50000000) return 0;
  if (loanAmount <= 100000000) return 35000; // 총 70,000원의 50%
  if (loanAmount <= 1000000000) return 75000; // 총 150,000원의 50%
  return 175000; // 10억 초과 시 350,000원의 50%
}

/**
 * 전세자금대출 갈아타기 자격 판정 및 순이자 절감액 계산
 * @param {Object} params
 * @param {number} params.loanBalance 현재 전세대출 잔액 (원)
 * @param {number} params.currentRatePercent 현재 적용 금리 (연 %, 예: 5.2)
 * @param {number} params.newRatePercent 갈아탈 신규 금리 (연 %, 예: 3.8)
 * @param {number} params.remainingMonths 남은 잔여 대출 기간 (개월, 예: 18)
 * @param {number} params.monthsElapsed 대출 실행 후 경과 개월수 (개월, 예: 6)
 * @param {number} params.totalLeaseMonths 전체 임대차 계약기간 (개월, 보통 24)
 * @param {boolean} params.isRenewalPeriod 갱신 계약 시점 여부 (만기 2개월 전 갱신)
 * @param {string} params.currentAgency 현재 보증기관 ('HUG', 'HF', 'SGI')
 * @param {string} params.targetAgency 갈아탈 보증기관 ('HUG', 'HF', 'SGI')
 */
export function calcJeonseRefinance(params) {
  const loanBalance = Math.max(0, parseFloat(params.loanBalance) || 0);
  const currentRatePercent = Math.max(0.1, parseFloat(params.currentRatePercent) || 5.2);
  const newRatePercent = Math.max(0.1, parseFloat(params.newRatePercent) || 3.8);
  const remainingMonths = Math.max(1, parseInt(params.remainingMonths, 10) || 18);
  const monthsElapsed = Math.max(0, parseInt(params.monthsElapsed, 10) || 6);
  const totalLeaseMonths = Math.max(12, parseInt(params.totalLeaseMonths, 10) || 24);
  const isRenewalPeriod = Boolean(params.isRenewalPeriod);
  const currentAgency = String(params.currentAgency || 'HF').toUpperCase();
  const targetAgency = String(params.targetAgency || 'HF').toUpperCase();

  // 1. 3대 자격 요건 판정
  // 요건 A: 대출 실행 3개월 경과
  const isElapsedEligible = monthsElapsed >= MIN_ELAPSED_MONTHS;

  // 요건 B: 임대차 계약기간 1/2 이전 또는 만기 갱신 2개월 전
  const halfTermMonths = totalLeaseMonths / 2;
  const isLeaseTermEligible = (monthsElapsed <= halfTermMonths) || isRenewalPeriod;

  // 요건 C: 보증기관 동일성 (HUG↔HUG, HF↔HF, SGI↔SGI)
  const isAgencyEligible = currentAgency === targetAgency;

  const isAllEligible = isElapsedEligible && isLeaseTermEligible && isAgencyEligible;

  // 2. 금융 계산
  const rateDiffPercent = Math.round(Math.max(0, currentRatePercent - newRatePercent) * 100) / 100;
  const rateDiff = rateDiffPercent / 100;

  // 총 명목 이자 절감액 (남은 기간 동안)
  const grossInterestSavings = loanBalance * rateDiff * (remainingMonths / 12);

  // 중도상환수수료 계산 (36개월 슬라이딩)
  let prepaymentPenaltyRate = 0;
  if (monthsElapsed < PREPAYMENT_PERIOD_MONTHS) {
    prepaymentPenaltyRate = MAX_PREPAYMENT_PENALTY_RATE * ((PREPAYMENT_PERIOD_MONTHS - monthsElapsed) / PREPAYMENT_PERIOD_MONTHS);
  }
  const prepaymentPenalty = loanBalance * prepaymentPenaltyRate;

  // 인지세 (대출자 50% 부담분)
  const stampDutyBorrower = calcStampDutyBorrowerShare(loanBalance);

  // 총 부대비용
  const totalSwitchingCost = prepaymentPenalty + stampDutyBorrower;

  // 순이자 절감액 (총 절감액 - 수수료/비용)
  const netSavings = Math.max(0, grossInterestSavings - totalSwitchingCost);

  // 손익분기점 (비용 회수 개월수)
  const monthlyGrossSavings = remainingMonths > 0 ? (grossInterestSavings / remainingMonths) : 0;
  const breakEvenMonths = monthlyGrossSavings > 0 
    ? Math.min(remainingMonths, Math.ceil(totalSwitchingCost / monthlyGrossSavings)) 
    : remainingMonths;

  return {
    loanBalance,
    currentRatePercent,
    newRatePercent,
    rateDiffPercent,
    remainingMonths,
    monthsElapsed,
    isElapsedEligible,
    isLeaseTermEligible,
    isAgencyEligible,
    isAllEligible,
    grossInterestSavings: Math.round(grossInterestSavings),
    prepaymentPenalty: Math.round(prepaymentPenalty),
    stampDutyBorrower: Math.round(stampDutyBorrower),
    totalSwitchingCost: Math.round(totalSwitchingCost),
    netSavings: Math.round(netSavings),
    monthlyGrossSavings: Math.round(monthlyGrossSavings),
    breakEvenMonths
  };
}
