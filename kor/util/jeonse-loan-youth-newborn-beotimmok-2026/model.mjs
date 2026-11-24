/**
 * 2026년 청년 버팀목 및 신생아 특례 버팀목 전세대출 한도·금리 계산 모델
 */

export function calculateBeotimmok2026(params) {
  const programType = params.programType || "youth"; // youth (청년 버팀목), newborn (신생아 특례)
  const depositAmount = Math.max(0, Number(params.depositAmount) || 200000000);   // 임차보증금 (원)
  const requestedLoan = Math.max(0, Number(params.requestedLoan) || 150000000);   // 희망 대출금 (원)
  const annualIncome = Math.max(0, Number(params.annualIncome) || 40000000);     // 부부합산 연소득 (원)
  const isDualIncome = Boolean(params.isDualIncome);                             // 맞벌이 여부
  const isUnder25Single = Boolean(params.isUnder25Single);                       // 만 25세 미만 단독세대주 여부
  const region = params.region || "capital";                                     // capital (수도권), non_capital (지방)
  const commercialBankRate = Math.max(1.0, Math.min(15.0, Number(params.commercialBankRate) || 4.3)); // 시중은행 전세대출 금리 (연 %)

  let maxDepositAllowed = 300000000;
  let maxLoanCap = 150000000;
  let maxIncomeAllowed = 50000000;
  let applicableRate = 2.5;
  let qualificationErrors = [];

  if (programType === "youth") {
    // 1. 청년 전용 버팀목
    maxDepositAllowed = 300000000; // 보증금 3억 이하
    maxIncomeAllowed = 50000000;   // 기본 5천만 이하
    maxLoanCap = isUnder25Single ? 120000000 : 150000000; // 25세 미만 1.2억, 일반 1.5억

    if (depositAmount > maxDepositAllowed) {
      qualificationErrors.push("임차보증금이 청년 버팀목 상한(3억 원)을 초과합니다.");
    }
    if (annualIncome > maxIncomeAllowed) {
      qualificationErrors.push("연소득이 청년 버팀목 소득요건(5,000만 원)을 초과합니다.");
    }

    // 금리 산정
    if (annualIncome <= 20000000) {
      applicableRate = 2.2;
    } else if (annualIncome <= 40000000) {
      applicableRate = 2.5;
    } else if (annualIncome <= 50000000) {
      applicableRate = 2.9;
    } else {
      applicableRate = 3.3;
    }
  } else {
    // 2. 신생아 특례 버팀목
    maxDepositAllowed = region === "capital" ? 500000000 : 400000000; // 수도권 5억, 지방 4억
    maxIncomeAllowed = isDualIncome ? 200000000 : 130000000; // 맞벌이 2억, 외벌이 1.3억
    maxLoanCap = 240000000; // 현행 최대 2.4억 원 (보증금 80% 이내)

    if (depositAmount > maxDepositAllowed) {
      qualificationErrors.push(`임차보증금이 신생아 특례 상한(${region === "capital" ? "수도권 5억" : "지방 4억"} 원)을 초과합니다.`);
    }
    if (annualIncome > maxIncomeAllowed) {
      qualificationErrors.push(`연소득이 신생아 특례 소득요건(${isDualIncome ? "맞벌이 2억" : "외벌이 1.3억"} 원)을 초과합니다.`);
    }

    // 신생아 특례 금리 산정 (4년 특례 기본)
    if (annualIncome <= 20000000) {
      applicableRate = 1.3;
    } else if (annualIncome <= 40000000) {
      applicableRate = 1.9;
    } else if (annualIncome <= 60000000) {
      applicableRate = 2.5;
    } else if (annualIncome <= 80000000) {
      applicableRate = 3.1;
    } else if (annualIncome <= 100000000) {
      applicableRate = 3.7;
    } else if (annualIncome <= 130000000) {
      applicableRate = 4.0;
    } else {
      applicableRate = 4.3;
    }
  }

  // 보증금의 80% 이내 한도
  const eightyPercentOfDeposit = Math.floor(depositAmount * 0.80);
  const possibleLoanMax = Math.min(maxLoanCap, eightyPercentOfDeposit);
  const finalLoanAmount = Math.min(requestedLoan, possibleLoanMax);

  // 이자 계산 (만기일시상환 기준 월 이자)
  const monthlyPolicyInterest = Math.floor((finalLoanAmount * (applicableRate / 100)) / 12);
  const monthlyCommercialInterest = Math.floor((finalLoanAmount * (commercialBankRate / 100)) / 12);
  const monthlyInterestSaving = Math.max(0, monthlyCommercialInterest - monthlyPolicyInterest);
  const twoYearSaving = monthlyInterestSaving * 24;

  const isEligible = qualificationErrors.length === 0 && finalLoanAmount > 0;

  return {
    programType,
    depositAmount,
    requestedLoan,
    annualIncome,
    isDualIncome,
    isUnder25Single,
    region,
    commercialBankRate,
    maxDepositAllowed,
    maxLoanCap,
    eightyPercentOfDeposit,
    possibleLoanMax,
    finalLoanAmount,
    applicableRate,
    monthlyPolicyInterest,
    monthlyCommercialInterest,
    monthlyInterestSaving,
    twoYearSaving,
    isEligible,
    qualificationErrors
  };
}
