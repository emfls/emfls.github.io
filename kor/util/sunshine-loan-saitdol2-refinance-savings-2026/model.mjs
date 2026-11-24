/**
 * Tool 503: 2026 통합 햇살론 일반보증 & 사잇돌2 대환대출 계산기
 * Pure deterministic ESM module.
 */

export function calcPmt(principal, annualRatePct, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRatePct <= 0) return Math.round(principal / months);
  const r = (annualRatePct / 100) / 12;
  const pmt = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(pmt);
}

export function calcTotalRepayment(principal, annualRatePct, months) {
  const pmt = calcPmt(principal, annualRatePct, months);
  const total = pmt * months;
  const interest = Math.max(0, total - principal);
  return { pmt, total, interest };
}

export function calcRefinanceSavings({
  currentBalance,
  currentRatePct = 18.0,
  remainingMonths = 36,
  annualIncome = 32000000,
  isLowCredit = true, // 하위 20%
  refinanceType = "sunshine", // sunshine or saitdol2
  hasEduDiscount = false,
  hasSocialDiscount = false
}) {
  // 1. 기존 대출 비용
  const orig = calcTotalRepayment(currentBalance, currentRatePct, remainingMonths);

  // 2. 대환 대출 조건 판정
  let eligible = true;
  let eligibilityReason = "신청 가능 대상입니다.";
  let maxLimit = 15000000;
  let newBaseRate = 9.5;
  let guaranteeFeeRate = 2.5;

  if (refinanceType === "sunshine") {
    maxLimit = 15000000;
    newBaseRate = 9.5;
    // 자격 판정: 연소득 3,500만 이하 또는 4,500만 이하 & 저신용
    if (annualIncome > 45000000) {
      eligible = false;
      eligibilityReason = "햇살론 연소득 상한(4,500만 원)을 초과하여 신청이 제한됩니다.";
    } else if (annualIncome > 35000000 && !isLowCredit) {
      eligible = false;
      eligibilityReason = "연소득 3,500만~4,500만 원 구간은 신용평점 하위 20%만 신청 가능합니다.";
    }
    // 보증료율 할인
    if (hasEduDiscount) guaranteeFeeRate -= 0.1;
    if (hasSocialDiscount) guaranteeFeeRate -= 0.5;
    guaranteeFeeRate = Math.max(1.0, guaranteeFeeRate);
  } else {
    // 사잇돌2
    maxLimit = 30000000;
    newBaseRate = 12.0;
    guaranteeFeeRate = 0; // 사잇돌2는 별도 보증료 없이 금리에 포함
    if (annualIncome < 12000000) {
      eligible = false;
      eligibilityReason = "사잇돌2 급여소득자 최소 연소득(1,200만 원) 미달입니다.";
    }
  }

  // 실제 대환 가능 금액
  const actualLoanAmount = Math.min(currentBalance, maxLimit);
  const unrefinancedBalance = Math.max(0, currentBalance - actualLoanAmount);

  // 대환 후 상환액
  const newLoan = calcTotalRepayment(actualLoanAmount, newBaseRate, remainingMonths);
  // 서민금융진흥원 보증료 (원리금균등 상환 시 평균 잔액 기준 근사: 대출액 * 보증료율 * (개월수/12) * 0.52)
  const totalGuaranteeFee = Math.round(actualLoanAmount * (guaranteeFeeRate / 100) * (remainingMonths / 12) * 0.52);

  // 미대환 잔여 대출(한도 초과분)이 있는 경우 기존 금리 유지
  const unrefinancedLoan = calcTotalRepayment(unrefinancedBalance, currentRatePct, remainingMonths);

  const combinedNewPmt = newLoan.pmt + unrefinancedLoan.pmt;
  const combinedNewInterest = newLoan.interest + unrefinancedLoan.interest;
  const totalCostAfter = combinedNewInterest + totalGuaranteeFee;

  // 절감액 산출
  const monthlySavings = Math.max(0, orig.pmt - combinedNewPmt);
  const totalInterestSavings = Math.max(0, orig.interest - totalCostAfter);

  // 보증료 포함 실질 체감 APR
  const effectiveApr = (actualLoanAmount > 0)
    ? Number((newBaseRate + guaranteeFeeRate).toFixed(2))
    : currentRatePct;

  // DSR 개선폭 (연소득 대비 원리금 상환액 비율)
  const origDsr = annualIncome > 0 ? Number(((orig.pmt * 12) / annualIncome * 100).toFixed(1)) : 0;
  const newDsr = annualIncome > 0 ? Number(((combinedNewPmt * 12) / annualIncome * 100).toFixed(1)) : 0;
  const dsrReduction = Number(Math.max(0, origDsr - newDsr).toFixed(1));

  return {
    eligible,
    eligibilityReason,
    refinanceType,
    maxLimit,
    actualLoanAmount,
    unrefinancedBalance,
    origPmt: orig.pmt,
    origTotalInterest: orig.interest,
    newPmt: combinedNewPmt,
    newTotalInterest: combinedNewInterest,
    totalGuaranteeFee,
    monthlySavings,
    totalInterestSavings,
    effectiveApr,
    origDsr,
    newDsr,
    dsrReduction
  };
}
