/**
 * 2026년 신용대출 및 마이너스통장(한도대출) DSR 5년 산정 만기 함정 계산 엔진
 * 금융위원회 DSR 규제 기준: 1금융권(은행) 40% vs 2금융권 50%
 * 핵심 함정: 실제 인출 잔액과 무관하게 '약정한도 전액'을 '5년 균등분할상환'으로 DSR에 산입!
 * 마통 보유로 증발하는 주택담보대출 한도 및 해지/감액 시 복원 한도 실시간 시뮬레이션
 */

export function calculateCreditLoanDsrTrap2026(inputs = {}) {
  const annualIncome = Math.max(1, Number(inputs.annualIncome) || 60000000);
  const minusAccountLimit = Math.max(0, Number(inputs.minusAccountLimit) || 0);
  const minusAccountRate = Math.max(0, Number(inputs.minusAccountRate) || 5.0);
  const actualUsedAmount = Math.min(minusAccountLimit, Math.max(0, Number(inputs.actualUsedAmount) || 0));
  const existingAnnualDebtService = Math.max(0, Number(inputs.existingAnnualDebtService) || 0);
  const financialSector = inputs.financialSector || "bank"; // bank (40%) vs nonBank (50%)
  const mortgageInterestRate = Math.max(0.1, Number(inputs.mortgageInterestRate) || 4.0);
  const mortgageTermYears = Math.min(50, Math.max(5, Number(inputs.mortgageTermYears) || 30));

  // 1. 금융기관별 DSR 한도 비율
  const dsrCapPercent = financialSector === "nonBank" ? 50 : 40;
  const maxAllowedAnnualDebtService = Math.floor(annualIncome * (dsrCapPercent / 100));

  // 2. 마이너스통장의 치명적 DSR 연간 부채 산정액 (금융당국 5년 의제 규정)
  // 원금 산정: 약정한도 / 5년 (약정한도의 20%를 매년 갚는 것으로 강제 간주!)
  const minusDsrPrincipal = Math.floor(minusAccountLimit / 5);
  // 이자 산정: 약정한도 * 대출금리
  const minusDsrInterest = Math.floor(minusAccountLimit * (minusAccountRate / 100));
  const minusAnnualDsrBurden = minusDsrPrincipal + minusDsrInterest;

  // 3. 실제 사용액 기준 실제 이자 부담
  const actualAnnualInterest = Math.floor(actualUsedAmount * (minusAccountRate / 100));
  const actualMonthlyInterest = Math.floor(actualAnnualInterest / 12);
  const actualDailyInterest = Math.floor(actualAnnualInterest / 365);

  // 4. 현재 총 DSR 비율 및 잔여 연간 상환 여력
  const currentTotalDebtService = existingAnnualDebtService + minusAnnualDsrBurden;
  const currentDsrPercent = Math.round((currentTotalDebtService / annualIncome) * 1000) / 10;
  const remainingDebtCapacity = Math.max(0, maxAllowedAnnualDebtService - currentTotalDebtService);

  // 5. 주택담보대출 가능 한도 역산 (PMT Formula)
  // 월 상환 여력 = 연간 잔여 여력 / 12
  const monthlyCapacity = remainingDebtCapacity / 12;
  const monthlyRate = (mortgageInterestRate / 100) / 12;
  const totalMonths = mortgageTermYears * 12;
  // 1원 차입 시 월 상환액: PMT = r * (1+r)^n / ((1+r)^n - 1)
  const pmtFactor = (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
  const mortgageBorrowingCapacity = Math.floor(monthlyCapacity / pmtFactor);

  // 6. 마이너스통장 해지 시 복원되는 주택담보대출 한도
  const restoredAnnualCapacity = Math.max(0, maxAllowedAnnualDebtService - existingAnnualDebtService);
  const restoredMonthlyCapacity = restoredAnnualCapacity / 12;
  const restoredMortgageCapacity = Math.floor(restoredMonthlyCapacity / pmtFactor);

  // 마통 보유로 인해 증발해버린 주택담보대출 한도 (DSR Trap Loss)
  const wipedOutMortgageAmount = Math.max(0, restoredMortgageCapacity - mortgageBorrowingCapacity);
  const wipedOutMultiplier = minusAccountLimit > 0 ? Math.round((wipedOutMortgageAmount / minusAccountLimit) * 10) / 10 : 0;

  // 7. 경고 및 조언 메시지 생성
  let dsrStatus = "SAFE";
  let statusMessage = "";
  if (currentDsrPercent > dsrCapPercent) {
    dsrStatus = "OVER_CAP";
    statusMessage = `⚠️ DSR 초과 위험: 현재 DSR이 ${currentDsrPercent}%로 법정 상한(${dsrCapPercent}%)을 초과하여 추가 대출이 전면 차단되었습니다.`;
  } else if (currentDsrPercent >= dsrCapPercent - 5) {
    dsrStatus = "WARNING";
    statusMessage = `⚡ DSR 한도 임박: 현재 DSR이 ${currentDsrPercent}%로 상한(${dsrCapPercent}%)에 근접하여 주택담보대출 한도가 대폭 축소되었습니다.`;
  } else {
    dsrStatus = "SAFE";
    statusMessage = `✅ DSR 적정: 현재 DSR은 ${currentDsrPercent}%로 잔여 대출 여력이 있습니다.`;
  }

  return {
    annualIncome,
    minusAccountLimit,
    minusAccountRate,
    actualUsedAmount,
    existingAnnualDebtService,
    financialSector,
    dsrCapPercent,
    maxAllowedAnnualDebtService,
    minusDsrPrincipal,
    minusDsrInterest,
    minusAnnualDsrBurden,
    actualAnnualInterest,
    actualMonthlyInterest,
    actualDailyInterest,
    currentTotalDebtService,
    currentDsrPercent,
    remainingDebtCapacity,
    mortgageInterestRate,
    mortgageTermYears,
    mortgageBorrowingCapacity,
    restoredMortgageCapacity,
    wipedOutMortgageAmount,
    wipedOutMultiplier,
    dsrStatus,
    statusMessage
  };
}
