/**
 * Tool 474: 2026년 신용카드 리볼빙·카드론 최고 20% 이자폭탄 & 은행/햇살론 대환 절감액 계산기
 * Pure deterministic ESM module.
 */

export const LEGAL_MAX_APR = 0.20; // 법정 최고금리 연 20%

/**
 * 리볼빙 및 대환 시뮬레이션
 * @param {Object} params
 * @param {number} params.balance 현재 리볼빙/카드론 잔액 (원)
 * @param {number} params.currentAprPercent 현재 카드사 적용 금리 (%, 예: 17.5)
 * @param {number} params.minPaymentRatioPercent 최소결제비율 (%, 예: 10 또는 20)
 * @param {number} params.targetRefinanceAprPercent 대환대출 목표 금리 (%, 예: 7.5)
 * @param {number} params.targetTermMonths 대환 상환 기간 (개월, 예: 24 또는 36)
 */
export function calcRevolvingPayoff(params) {
  const balance = Math.max(0, parseFloat(params.balance) || 0);
  const currentAprPercent = Math.max(1, Math.min(20, parseFloat(params.currentAprPercent) || 17.5));
  const minPaymentRatioPercent = Math.max(5, Math.min(100, parseFloat(params.minPaymentRatioPercent) || 10));
  const targetRefinanceAprPercent = Math.max(1, Math.min(20, parseFloat(params.targetRefinanceAprPercent) || 7.5));
  const targetTermMonths = Math.max(6, Math.min(60, parseInt(params.targetTermMonths, 10) || 24));

  const monthlyCurrentRate = (currentAprPercent / 100) / 12;
  const minRatio = minPaymentRatioPercent / 100;

  // 1. 리볼빙 최소결제 유지 시뮬레이션 (최대 120개월 제한)
  let curBal = balance;
  let totalRevolvingInterest = 0;
  let revolvingMonths = 0;
  const maxSimMonths = 120;

  while (curBal > 10000 && revolvingMonths < maxSimMonths) {
    revolvingMonths++;
    const monthlyInterest = curBal * monthlyCurrentRate;
    totalRevolvingInterest += monthlyInterest;
    
    // 최소결제금액: 잔액의 minRatio + 당월 발생 이자
    let payment = curBal * minRatio;
    if (payment < 30000) payment = Math.min(curBal + monthlyInterest, 30000);
    
    const principalPaid = Math.max(0, payment - monthlyInterest);
    curBal = Math.max(0, curBal - principalPaid);
  }

  // 잔여금이 남았을 경우 (120개월 초과 시)
  const isCappedAt120 = revolvingMonths >= maxSimMonths && curBal > 10000;

  // 2. 대환대출(원리금균등분할상환) 시뮬레이션
  const monthlyRefinanceRate = (targetRefinanceAprPercent / 100) / 12;
  let monthlyRefinancePayment = 0;
  let totalRefinanceInterest = 0;

  if (balance > 0 && targetTermMonths > 0) {
    if (monthlyRefinanceRate > 0) {
      monthlyRefinancePayment = balance * (monthlyRefinanceRate * Math.pow(1 + monthlyRefinanceRate, targetTermMonths)) /
        (Math.pow(1 + monthlyRefinanceRate, targetTermMonths) - 1);
      totalRefinanceInterest = (monthlyRefinancePayment * targetTermMonths) - balance;
    } else {
      monthlyRefinancePayment = balance / targetTermMonths;
      totalRefinanceInterest = 0;
    }
  }

  // 3. 절감액 및 비교
  const totalInterestSavings = Math.max(0, totalRevolvingInterest - totalRefinanceInterest);
  const monthsSaved = isCappedAt120 ? Math.max(0, 120 - targetTermMonths) : Math.max(0, revolvingMonths - targetTermMonths);
  const interestReductionPercent = totalRevolvingInterest > 0 
    ? Math.round((totalInterestSavings / totalRevolvingInterest) * 100) 
    : 0;

  return {
    balance,
    currentAprPercent,
    minPaymentRatioPercent,
    targetRefinanceAprPercent,
    targetTermMonths,
    revolvingMonths,
    isCappedAt120,
    totalRevolvingInterest: Math.round(totalRevolvingInterest),
    monthlyRefinancePayment: Math.round(monthlyRefinancePayment),
    totalRefinanceInterest: Math.round(totalRefinanceInterest),
    totalInterestSavings: Math.round(totalInterestSavings),
    monthsSaved,
    interestReductionPercent
  };
}
