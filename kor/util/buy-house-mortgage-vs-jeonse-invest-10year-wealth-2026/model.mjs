/**
 * Tool 496: 2026년 내 집 마련 vs 전세+투자 10년 순자산 비교기
 * Pure deterministic ESM module.
 */

export const ACQUISITION_TAX_RATE = 0.015; // 1주택자 취득세+지방교육세 평균 약 1.5% (6억~9억 구간 실효)
export const BROKERAGE_FEE_RATE = 0.004;   // 부동산 중개보수 0.4%

/**
 * 30년 원리금균등 상환 월 납입액
 */
export function calcMonthlyAmortization(principal, annualRate, termYears = 30) {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  return Math.round(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

/**
 * t개월 후 대출 잔여원금 계산
 */
export function calcRemainingPrincipal(principal, annualRate, termYears, monthsPassed) {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  const p = Math.min(n, monthsPassed);
  const factorTotal = Math.pow(1 + r, n);
  const factorPassed = Math.pow(1 + r, p);
  const remaining = principal * (factorTotal - factorPassed) / (factorTotal - 1);
  return Math.max(0, Math.round(remaining));
}

/**
 * 미래가치(FV) 계산: 일시금 복리
 */
export function calcLumpSumFv(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return principal;
  return Math.round(principal * Math.pow(1 + annualRate, years));
}

/**
 * 미래가치(FV) 계산: 매월 적립 복리
 */
export function calcMonthlyAnnuityFv(monthlyDeposit, annualRate, years) {
  if (monthlyDeposit <= 0 || years <= 0) return 0;
  if (annualRate <= 0) return monthlyDeposit * years * 12;
  const r = annualRate / 12;
  const n = years * 12;
  const fv = monthlyDeposit * (Math.pow(1 + r, n) - 1) / r;
  return Math.round(fv);
}

/**
 * 매매 vs 전세+투자 10년 순자산 통합 산정
 */
export function calcBuyVsJeonseWealth(params) {
  const purchasePrice = Math.max(0, Number(params.purchasePrice) || 0);
  const mortgagePrincipal = Math.max(0, Number(params.mortgagePrincipal) || 0);
  const mortgageRate = Math.max(0.01, Number(params.mortgageRate) || 0.040); // 주담대 4.0%
  const mortgageTermYears = Number(params.mortgageTermYears) || 30;

  const jeonseDeposit = Math.max(0, Number(params.jeonseDeposit) || 0);
  const jeonseLoan = Math.max(0, Number(params.jeonseLoan) || 0);
  const jeonseLoanRate = Math.max(0.01, Number(params.jeonseLoanRate) || 0.038); // 전세대출 3.8%

  const investmentReturnRate = Math.max(0, Number(params.investmentReturnRate) || 0.070); // ETF 복리 7.0%
  const houseAppreciationRate = Number(params.houseAppreciationRate) || 0.025; // 집값 연 2.5%

  const years = 10;
  const months = years * 12;

  // 1. 초기 투입 비용
  const purchaseEquity = Math.max(0, purchasePrice - mortgagePrincipal);
  const acquisitionTax = Math.round(purchasePrice * ACQUISITION_TAX_RATE);
  const buyBrokerage = Math.round(purchasePrice * BROKERAGE_FEE_RATE);
  const totalBuyInitialCash = purchaseEquity + acquisitionTax + buyBrokerage;

  const jeonseEquity = Math.max(0, jeonseDeposit - jeonseLoan);
  const jeonseBrokerage = Math.round(jeonseDeposit * BROKERAGE_FEE_RATE);
  const totalJeonseInitialCash = jeonseEquity + jeonseBrokerage;

  // 초기 여유자금 (매매 대비 전세 시 세이브한 목돈)
  const initialCashDifference = Math.max(0, totalBuyInitialCash - totalJeonseInitialCash);

  // 2. 월 현금 유출
  const buyMonthlyPmt = calcMonthlyAmortization(mortgagePrincipal, mortgageRate, mortgageTermYears);
  const buyMonthlyTaxMaintenance = Math.round(purchasePrice * 0.0015 / 12); // 재산세/유지보수 연 0.15%
  const totalBuyMonthlyCash = buyMonthlyPmt + buyMonthlyTaxMaintenance;

  const jeonseMonthlyInterest = Math.round((jeonseLoan * jeonseLoanRate) / 12);
  const jeonseMonthlyFee = Math.round(jeonseDeposit * 0.0013 / 12); // 보증보험료 등
  const totalJeonseMonthlyCash = jeonseMonthlyInterest + jeonseMonthlyFee;

  // 월 여유자금 차액 (전세 거주 시 매월 세이브해 적립 투자할 수 있는 돈)
  const monthlyCashSavings = Math.max(0, totalBuyMonthlyCash - totalJeonseMonthlyCash);

  // 3. 10년 후 매매 경로 순자산
  const futureHouseValue = Math.round(purchasePrice * Math.pow(1 + houseAppreciationRate, years));
  const remainingMortgage = calcRemainingPrincipal(mortgagePrincipal, mortgageRate, mortgageTermYears, months);
  const sellingBrokerage = Math.round(futureHouseValue * BROKERAGE_FEE_RATE);
  const buyNetWorth = Math.max(0, futureHouseValue - remainingMortgage - sellingBrokerage);

  // 4. 10년 후 전세 경로 순자산
  // a) 초기 절감 목돈의 10년 복리 미래가치
  const initialSavingsFv = calcLumpSumFv(initialCashDifference, investmentReturnRate, years);
  // b) 매월 절감액의 10년 적립 복리 미래가치
  const monthlySavingsFv = calcMonthlyAnnuityFv(monthlyCashSavings, investmentReturnRate, years);
  // c) 전세 보증금 본인 지분
  const jeonseNetWorth = jeonseEquity + initialSavingsFv + monthlySavingsFv;

  // 5. 손익 비교 및 순자산 격차
  const wealthDifference = buyNetWorth - jeonseNetWorth;
  const isBuyWinner = wealthDifference > 0;

  // 6. 손익분기 연 상승률 (Breakeven Appreciation Rate) 역산
  // Target future value = jeonseNetWorth + remainingMortgage + sellingBrokerage
  // (1 + g)^10 * purchasePrice * (1 - BROKERAGE_FEE_RATE) = jeonseNetWorth + remainingMortgage
  let breakevenAppreciationRate = 0;
  if (purchasePrice > 0) {
    const requiredFutureValue = (jeonseNetWorth + remainingMortgage) / (1 - BROKERAGE_FEE_RATE);
    const growthMultiple = requiredFutureValue / purchasePrice;
    if (growthMultiple > 0) {
      breakevenAppreciationRate = Math.pow(growthMultiple, 1 / years) - 1;
    }
  }

  return {
    purchasePrice,
    mortgagePrincipal,
    purchaseEquity,
    totalBuyInitialCash,
    buyMonthlyPmt,
    totalBuyMonthlyCash,
    jeonseDeposit,
    jeonseLoan,
    jeonseEquity,
    totalJeonseInitialCash,
    totalJeonseMonthlyCash,
    initialCashDifference,
    monthlyCashSavings,
    houseAppreciationRate: Math.round(houseAppreciationRate * 1000) / 10,
    futureHouseValue,
    remainingMortgage,
    buyNetWorth,
    initialSavingsFv,
    monthlySavingsFv,
    jeonseNetWorth,
    wealthDifference,
    isBuyWinner,
    breakevenAppreciationRate: Math.round(breakevenAppreciationRate * 1000) / 10
  };
}
