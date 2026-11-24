/**
 * 2026~2029년 가상자산(코인) 과세 시뮬레이터 계산 엔진
 * 기본공제 250만 원 · 22% 분리과세(소득세 20% + 지방소득세 2%)
 * 2029년 추가 유예(4차 유예) 추진 및 3년 손실 이월공제 반영
 * 연말 분할 매도(250만 원 비과세 한도 하베스팅) 절세 비교
 */

export function calculateCryptoTaxSimulator2026(inputs = {}) {
  const annualGains = Math.max(0, Number(inputs.annualGains) || 0);
  const annualLosses = Math.max(0, Number(inputs.annualLosses) || 0);
  const transactionFees = Math.max(0, Number(inputs.transactionFees) || 0);
  const priorLossCarryforward = Math.max(0, Number(inputs.priorLossCarryforward) || 0);
  const apply2029DelayReform = inputs.apply2029DelayReform !== undefined ? Boolean(inputs.apply2029DelayReform) : true;
  const stagedSellingYears = Math.min(5, Math.max(1, Number(inputs.stagedSellingYears) || 1));

  // 1. 당해 연도 순양도차익 계산
  const netTradingProfit = Math.max(0, annualGains - annualLosses - transactionFees);

  // 2. 이월결손금(3년) 공제 적용 (2029 개정안 적용 시)
  let effectivePriorLoss = 0;
  if (apply2029DelayReform) {
    effectivePriorLoss = Math.min(netTradingProfit, priorLossCarryforward);
  }
  const profitAfterLoss = Math.max(0, netTradingProfit - effectivePriorLoss);

  // 3. 기본공제 250만 원 적용
  const basicDeduction = 2500000;
  const taxBase = Math.max(0, profitAfterLoss - basicDeduction);

  // 4. 과세 시행 시 예상 세액 (22% = 국세 20% + 지방세 2%)
  const nationalTax = Math.floor(taxBase * 0.20);
  const localTax = Math.floor(taxBase * 0.02);
  const projectedTax = nationalTax + localTax;

  // 2026년 현행 상태 (유예 기간 중으로 0원)
  const current2026Tax = 0;

  const effectiveTaxRate = netTradingProfit > 0 ? Math.round((projectedTax / netTradingProfit) * 1000) / 10 : 0;
  const netTakeHome = netTradingProfit - projectedTax;

  // 5. 연말 분할 매도(250만 원 기본공제 하베스팅) 전략
  // stagedSellingYears에 걸쳐 매년 250만 원 공제를 분할 적용
  let stagedTotalTax = 0;
  let stagedAnnualTaxBase = 0;
  if (profitAfterLoss > 0) {
    const annualStagedProfit = Math.floor(profitAfterLoss / stagedSellingYears);
    stagedAnnualTaxBase = Math.max(0, annualStagedProfit - basicDeduction);
    stagedTotalTax = Math.floor(stagedAnnualTaxBase * 0.22 * stagedSellingYears);
  }
  const stagedSaving = Math.max(0, projectedTax - stagedTotalTax);

  // 6. 주식 등 타 자산군 비교
  // 해외주식: 기본공제 250만 원, 22% 양도소득세 (손실이월 불가)
  const overseasStockTaxBase = Math.max(0, netTradingProfit - basicDeduction);
  const overseasStockTax = Math.floor(overseasStockTaxBase * 0.22);

  // 국내주식: 대주주 제외 비과세 (0원)
  const domesticStockTax = 0;

  let reformStatusText = "";
  if (apply2029DelayReform) {
    reformStatusText = "2029년 추가 유예 법안 반영 (3년 손실이월 인정)";
  } else {
    reformStatusText = "정부 원안 2027년 시행 (손실이월 미적용)";
  }

  return {
    annualGains,
    annualLosses,
    transactionFees,
    priorLossCarryforward,
    apply2029DelayReform,
    stagedSellingYears,
    netTradingProfit,
    effectivePriorLoss,
    profitAfterLoss,
    basicDeduction,
    taxBase,
    nationalTax,
    localTax,
    projectedTax,
    current2026Tax,
    effectiveTaxRate,
    netTakeHome,
    stagedTotalTax,
    stagedSaving,
    overseasStockTax,
    domesticStockTax,
    reformStatusText
  };
}
