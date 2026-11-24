/**
 * 2026년 전세 vs 월세 전환율 및 순주거비 비교 모델
 */

export function calculateJeonseVsWolse(params) {
  const jeonseDeposit = Math.max(0, Number(params.jeonseDeposit) || 0);       // 전세 보증금 (원)
  const jeonseOwnFunds = Math.max(0, Number(params.jeonseOwnFunds) || 0);     // 전세 자기자금 (원)
  const jeonseLoanRate = Math.max(0, Number(params.jeonseLoanRate) || 0);     // 전세대출 금리 (연 %)
  const bokBaseRate = Math.max(0, Number(params.bokBaseRate) || 3.0);         // 한국은행 기준금리 (연 %)
  const opportunityRate = Math.max(0, Number(params.opportunityRate) || 3.2); // 자기자금 예금/기회비용 금리 (연 %)
  const guaranteeFeeRate = Math.max(0, Number(params.guaranteeFeeRate) || 0.128); // 보증보험료율 (연 %)

  const wolseDeposit = Math.max(0, Number(params.wolseDeposit) || 0);         // 월세 보증금 (원)
  const monthlyRent = Math.max(0, Number(params.monthlyRent) || 0);           // 약정 월세 (원)
  const totalSalary = Math.max(0, Number(params.totalSalary) || 0);           // 총급여 (원)
  const isHomelessHead = Boolean(params.isHomelessHead);                      // 무주택 세대주 여부
  const isEligibleHouse = Boolean(params.isEligibleHouse);                    // 국민주택규모(85m2) 또는 기준시가 4억 이하 주택

  // 1. 법정 전월세 전환율 상한 산출
  // 주택임대차보호법 제7조의2: min(기준금리 + 2.0%, 10%)
  const legalConversionRate = Math.min(10.0, Math.round((bokBaseRate + 2.0) * 100) / 100);

  // 전세보증금과 월세보증금 차액에 대한 법정 월세 상한
  const depositDiff = Math.max(0, jeonseDeposit - wolseDeposit);
  const legalMaxMonthlyRent = Math.round((depositDiff * (legalConversionRate / 100)) / 12);

  // 실제 적용 전월세 전환율
  const actualConversionRate = depositDiff > 0 
    ? Math.round((monthlyRent * 12 / depositDiff) * 10000) / 100 
    : 0;
  const isLegalRateExceeded = actualConversionRate > legalConversionRate;

  // 2. 전세(Plan A) 비용 분석
  const jeonseLoanAmount = Math.max(0, jeonseDeposit - jeonseOwnFunds);
  const monthlyJeonseLoanInterest = Math.round((jeonseLoanAmount * (jeonseLoanRate / 100)) / 12);
  const monthlyJeonseOpportunity = Math.round((jeonseOwnFunds * (opportunityRate / 100)) / 12);
  const monthlyGuaranteeFee = Math.round((jeonseDeposit * (guaranteeFeeRate / 100)) / 12);
  const totalMonthlyJeonseCost = monthlyJeonseLoanInterest + monthlyJeonseOpportunity + monthlyGuaranteeFee;

  // 3. 월세(Plan B) 세액공제 분석 (2026 조특법 제95조의2)
  // 무주택 세대주 + 적격주택 + 연 1,000만 원 한도
  // 총급여 <= 5,500만: 17% (최대 170만)
  // 5,500만 < 총급여 <= 8,000만: 15% (최대 150만)
  let taxDeductionRate = 0;
  if (isHomelessHead && isEligibleHouse) {
    if (totalSalary <= 55000000) {
      taxDeductionRate = 0.17;
    } else if (totalSalary <= 80000000) {
      taxDeductionRate = 0.15;
    }
  }

  const annualRentTotal = monthlyRent * 12;
  const eligibleRentForDeduction = Math.min(annualRentTotal, 10000000);
  const annualTaxRefund = Math.round(eligibleRentForDeduction * taxDeductionRate);
  const monthlyEffectiveTaxRefund = Math.round(annualTaxRefund / 12);

  // 월세 보증금 기회비용
  const monthlyWolseDepositOpportunity = Math.round((wolseDeposit * (opportunityRate / 100)) / 12);
  // 월세 자기자금 잉여분 (전세 자기자금 중 월세 보증금 내고 남은 금액의 예금 이자)
  const remainingFunds = Math.max(0, jeonseOwnFunds - wolseDeposit);
  const monthlyRemainingFundsYield = Math.round((remainingFunds * (opportunityRate / 100)) / 12);

  const totalMonthlyWolseCost = Math.round(monthlyRent - monthlyEffectiveTaxRefund + monthlyWolseDepositOpportunity - monthlyRemainingFundsYield);

  // 4. 전세 vs 월세 비교 판정
  const monthlyDifference = Math.abs(totalMonthlyJeonseCost - totalMonthlyWolseCost);
  const twoYearDifference = monthlyDifference * 24;
  const recommendedPlan = totalMonthlyJeonseCost < totalMonthlyWolseCost ? "JEONSE" : "WOLSE";

  return {
    legalConversionRate,
    depositDiff,
    legalMaxMonthlyRent,
    actualConversionRate,
    isLegalRateExceeded,
    jeonseLoanAmount,
    monthlyJeonseLoanInterest,
    monthlyJeonseOpportunity,
    monthlyGuaranteeFee,
    totalMonthlyJeonseCost,
    taxDeductionRate,
    annualTaxRefund,
    monthlyEffectiveTaxRefund,
    monthlyWolseDepositOpportunity,
    monthlyRemainingFundsYield,
    totalMonthlyWolseCost,
    monthlyDifference,
    twoYearDifference,
    recommendedPlan
  };
}
