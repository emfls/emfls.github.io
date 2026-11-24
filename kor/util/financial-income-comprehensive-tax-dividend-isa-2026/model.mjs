/**
 * 2026년 금융소득종합과세, 고배당기업 배당소득 분리과세 특례, 직장인 건보료 추가부과 & ISA 절세 모델
 */

export function calculateFinancialTax2026(params) {
  const financialIncome = Math.max(0, Number(params.financialIncome) || 0);     // 총 금융소득 (이자+배당, 원)
  const highDividendPortion = Math.min(financialIncome, Math.max(0, Number(params.highDividendPortion) || 0)); // 이 중 고배당기업 배당금
  const otherTaxableIncome = Math.max(0, Number(params.otherTaxableIncome) || 0); // 근로/사업 등 타 종합소득 과세표준
  const isEmployee = params.isEmployee !== undefined ? Boolean(params.isEmployee) : true; // 직장가입자 여부
  const isIsaApplied = Boolean(params.isIsaApplied); // ISA 계좌 활용 여부
  const isaType = params.isaType || "general"; // general (일반형), rural (서민형)
  const isIsaExpanded = Boolean(params.isIsaExpanded); // 2026 세법개정 확대안 (일반 500만/서민 1,000만)

  // 1. 소득세 누진세율표 (2026년 과표 기준)
  function getProgressiveTax(taxBase) {
    if (taxBase <= 0) return 0;
    if (taxBase <= 14000000) return Math.floor(taxBase * 0.06);
    if (taxBase <= 50000000) return Math.floor(840000 + (taxBase - 14000000) * 0.15);
    if (taxBase <= 88000000) return Math.floor(6240000 + (taxBase - 50000000) * 0.24);
    if (taxBase <= 150000000) return Math.floor(15360000 + (taxBase - 88000000) * 0.35);
    if (taxBase <= 300000000) return Math.floor(37060000 + (taxBase - 150000000) * 0.38);
    if (taxBase <= 500000000) return Math.floor(94060000 + (taxBase - 300000000) * 0.40);
    if (taxBase <= 1000000000) return Math.floor(174060000 + (taxBase - 500000000) * 0.42);
    return Math.floor(384060000 + (taxBase - 1000000000) * 0.45);
  }

  const threshold = 20000000; // 2,000만 원 금융소득종합과세 기준선
  const isSubjectToComprehensive = financialIncome > threshold;
  const excessIncome = Math.max(0, financialIncome - threshold);

  // 2. [기본 케이스] 종합소득 합산과세 시 세액 계산 (비교과세 소득세법 제62조)
  let generalTaxTotal = 0;
  let regularIncomeTax = 0;
  let regularLocalTax = 0;

  if (!isSubjectToComprehensive) {
    // 2천만 원 이하: 14% 소득세 + 1.4% 지방세 = 15.4% 원천징수 분리과세
    regularIncomeTax = Math.floor(financialIncome * 0.14);
    regularLocalTax = Math.floor(regularIncomeTax * 0.10);
    generalTaxTotal = regularIncomeTax + regularLocalTax;
  } else {
    // 2천만 원 초과 종합과세 비교과세:
    // 산출세액 1: 타소득 누진세 + 2천만*14% + 2천만 초과분*누진세율
    const baseOtherTax = getProgressiveTax(otherTaxableIncome);
    const combinedTax = getProgressiveTax(otherTaxableIncome + excessIncome);
    const method1 = (combinedTax - baseOtherTax) + Math.floor(threshold * 0.14);
    // 산출세액 2: 전체 금융소득 * 14%
    const method2 = Math.floor(financialIncome * 0.14);
    regularIncomeTax = Math.max(method1, method2);
    regularLocalTax = Math.floor(regularIncomeTax * 0.10);
    generalTaxTotal = regularIncomeTax + regularLocalTax;
  }

  // 3. 직장가입자 보수외소득월액 건강보험료 추가 부과 계산
  // 연간 2,000만 원 초과 금액에 대해 월 건보료 부과: (초과액 / 12) * 7.19% * (1 + 0.1314)
  let annualExtraNhis = 0;
  let monthlyExtraNhis = 0;
  if (isEmployee && isSubjectToComprehensive) {
    // 2026 건보료율 7.19%, 장기요양 13.14% (실질 8.134766%)
    const nhisRate = 0.0719;
    const ltcRate = 0.1314;
    const annualNhisOnly = Math.floor(excessIncome * nhisRate);
    const annualLtcOnly = Math.floor(annualNhisOnly * ltcRate);
    annualExtraNhis = annualNhisOnly + annualLtcOnly;
    monthlyExtraNhis = Math.floor(annualExtraNhis / 12);
  }

  const totalComprehensiveBurden = generalTaxTotal + annualExtraNhis;

  // 4. [2026 신설] 고배당기업 배당소득 분리과세 특례 선택 시 계산
  // 요건 충족 고배당주 배당금에 대해 종합과세 합산 대신 별도 세율 적용:
  // <=2,000만: 14%, 2,000만~3억: 20%, 3억~50억: 25%, >50억: 30% (+ 지방세 10%)
  // 그리고 분리과세된 고배당금은 보수외소득 건보료 산정에서도 배제!
  let highDividendTax = 0;
  if (highDividendPortion > 0) {
    if (highDividendPortion <= 20000000) {
      highDividendTax = Math.floor(highDividendPortion * 0.14);
    } else if (highDividendPortion <= 300000000) {
      highDividendTax = Math.floor(20000000 * 0.14 + (highDividendPortion - 20000000) * 0.20);
    } else if (highDividendPortion <= 5000000000) {
      highDividendTax = Math.floor(20000000 * 0.14 + 280000000 * 0.20 + (highDividendPortion - 300000000) * 0.25);
    } else {
      highDividendTax = Math.floor(20000000 * 0.14 + 280000000 * 0.20 + 4700000000 * 0.25 + (highDividendPortion - 5000000000) * 0.30);
    }
  }
  const highDividendLocalTax = Math.floor(highDividendTax * 0.10);
  const highDividendTaxTotal = highDividendTax + highDividendLocalTax;

  // 나머지 일반 금융소득에 대한 세액
  const remainingFinancialIncome = Math.max(0, financialIncome - highDividendPortion);
  let remainingTaxTotal = 0;
  let remainingExtraNhis = 0;
  if (remainingFinancialIncome <= threshold) {
    const remIncTax = Math.floor(remainingFinancialIncome * 0.14);
    remainingTaxTotal = remIncTax + Math.floor(remIncTax * 0.10);
  } else {
    const remExcess = remainingFinancialIncome - threshold;
    const baseOtherTax = getProgressiveTax(otherTaxableIncome);
    const combinedTax = getProgressiveTax(otherTaxableIncome + remExcess);
    const method1 = (combinedTax - baseOtherTax) + Math.floor(threshold * 0.14);
    const method2 = Math.floor(remainingFinancialIncome * 0.14);
    const remIncTax = Math.max(method1, method2);
    remainingTaxTotal = remIncTax + Math.floor(remIncTax * 0.10);

    if (isEmployee) {
      const annualNhisOnly = Math.floor(remExcess * 0.0719);
      const annualLtcOnly = Math.floor(annualNhisOnly * 0.1314);
      remainingExtraNhis = annualNhisOnly + annualLtcOnly;
    }
  }

  const totalSpecialBurden = highDividendTaxTotal + remainingTaxTotal + remainingExtraNhis;
  const specialSeparationSaving = Math.max(0, totalComprehensiveBurden - totalSpecialBurden);
  const isSpecialRecommended = highDividendPortion > 0 && totalSpecialBurden < totalComprehensiveBurden;

  // 5. [ISA 계좌 활용 시 절세액 시뮬레이션]
  // 비과세 한도: 일반형 200만(확대 500만), 서민형 400만(확대 1,000만)
  let isaTaxFreeLimit = 2000000;
  if (isaType === "rural") {
    isaTaxFreeLimit = isIsaExpanded ? 10000000 : 4000000;
  } else {
    isaTaxFreeLimit = isIsaExpanded ? 5000000 : 2000000;
  }

  // 만약 ISA 계좌에 배당금 일부(예: 2,000만 한도 내)를 넣을 경우의 절세액
  const isaApplicableAmount = Math.min(financialIncome, 20000000);
  const isaTaxFreeAmount = Math.min(isaApplicableAmount, isaTaxFreeLimit);
  const isa99Amount = Math.max(0, isaApplicableAmount - isaTaxFreeAmount);
  // ISA 계좌 세액 = 0원 + 초과분 * 9.9%
  const isaTax = Math.floor(isa99Amount * 0.099);
  // 일반계좌 대비 절세액 (일반계좌는 15.4% 또는 종합과세 누진세율)
  const regularIsaEquivalentTax = Math.floor(isaApplicableAmount * 0.154);
  const isaTaxSaving = Math.max(0, regularIsaEquivalentTax - isaTax);

  return {
    financialIncome,
    highDividendPortion,
    otherTaxableIncome,
    isEmployee,
    threshold,
    isSubjectToComprehensive,
    excessIncome,
    regularIncomeTax,
    regularLocalTax,
    generalTaxTotal,
    annualExtraNhis,
    monthlyExtraNhis,
    totalComprehensiveBurden,
    highDividendTaxTotal,
    remainingTaxTotal,
    totalSpecialBurden,
    specialSeparationSaving,
    isSpecialRecommended,
    isaType,
    isIsaExpanded,
    isaTaxFreeLimit,
    isaTaxSaving
  };
}
