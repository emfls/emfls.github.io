/**
 * Tool 502: 2026 개인사업자 종합소득세 단순경비율 vs 기준경비율 vs 장부신고 비교 계산기
 * Pure deterministic ESM module.
 */

// 2026 종합소득세 세율 (지방세 10% 미포함 기본세액)
export function calcTaxBaseToTax(taxBase) {
  if (taxBase <= 0) return 0;
  if (taxBase <= 14000000) return Math.round(taxBase * 0.06);
  if (taxBase <= 50000000) return Math.round(taxBase * 0.15 - 1260000);
  if (taxBase <= 88000000) return Math.round(taxBase * 0.24 - 5760000);
  if (taxBase <= 150000000) return Math.round(taxBase * 0.35 - 15440000);
  if (taxBase <= 300000000) return Math.round(taxBase * 0.38 - 19940000);
  if (taxBase <= 500000000) return Math.round(taxBase * 0.40 - 25940000);
  if (taxBase <= 1000000000) return Math.round(taxBase * 0.42 - 35940000);
  return Math.round(taxBase * 0.45 - 65940000);
}

export const INDUSTRY_THRESHOLDS = {
  A: { name: "도소매·부동산매매", simpleLimit: 60000000, doubleBookLimit: 300000000 },
  B: { name: "제조·음식·숙박·프리랜서", simpleLimit: 36000000, doubleBookLimit: 150000000 },
  C: { name: "부동산임대·서비스업", simpleLimit: 24000000, doubleBookLimit: 75000000 }
};

export function calcBusinessExpenseTax({
  revenue,
  industryGroup = "B",
  priorRevenue = 0,
  simpleRate = 0.65,
  standardRate = 0.18,
  majorExpenses = 0,
  otherExpenses = 0,
  basicDeduction = 1500000
}) {
  const conf = INDUSTRY_THRESHOLDS[industryGroup] || INDUSTRY_THRESHOLDS.B;
  const isSimpleEligible = priorRevenue < conf.simpleLimit;
  const isDoubleBookObligated = priorRevenue >= conf.doubleBookLimit;

  // 1. 단순경비율 추계
  const simpleExpense = revenue * simpleRate;
  const simpleIncome = Math.max(0, revenue - simpleExpense);
  const simpleTaxBase = Math.max(0, simpleIncome - basicDeduction);
  const simpleRawTax = calcTaxBaseToTax(simpleTaxBase);
  // 무기장가산세 (직전연도 4,800만 이상 시 20%)
  const simplePenalty = (priorRevenue >= 48000000) ? Math.round(simpleRawTax * 0.20) : 0;
  const simpleTotalTax = Math.round((simpleRawTax + simplePenalty) * 1.1);

  // 2. 기준경비율 추계 (주요경비 + 수입*기준경비율)
  const stdDirectExpense = majorExpenses + (revenue * standardRate);
  let stdIncome = Math.max(0, revenue - stdDirectExpense);
  // 배율 한도 적용 (간편 2.8배, 복식 3.4배)
  const capMultiplier = isDoubleBookObligated ? 3.4 : 2.8;
  const maxIncomeCap = simpleIncome * capMultiplier;
  if (stdIncome > maxIncomeCap && simpleIncome > 0) {
    stdIncome = maxIncomeCap;
  }
  const stdTaxBase = Math.max(0, stdIncome - basicDeduction);
  const stdRawTax = calcTaxBaseToTax(stdTaxBase);
  const stdPenalty = (priorRevenue >= 48000000) ? Math.round(stdRawTax * 0.20) : 0;
  const stdTotalTax = Math.round((stdRawTax + stdPenalty) * 1.1);

  // 3. 실제 장부 신고 (간편장부 or 복식부기)
  const bookTotalExpense = majorExpenses + otherExpenses;
  const bookIncome = Math.max(0, revenue - bookTotalExpense);
  const bookTaxBase = Math.max(0, bookIncome - basicDeduction);
  const bookRawTax = calcTaxBaseToTax(bookTaxBase);
  // 기장세액공제 (간편장부대상자가 복식부기 작성 시 20%, 최대 100만 원)
  let bookCredit = 0;
  if (!isDoubleBookObligated && bookRawTax > 0) {
    bookCredit = Math.min(1000000, Math.round(bookRawTax * 0.20));
  }
  const bookFinalTaxOnly = Math.max(0, bookRawTax - bookCredit);
  const bookTotalTax = Math.round(bookFinalTaxOnly * 1.1);

  // 비교 분석
  const applicableEstimationTax = isSimpleEligible ? simpleTotalTax : stdTotalTax;
  const savingsByBook = applicableEstimationTax - bookTotalTax;

  let recommendation = "장부신고가 유리합니다.";
  if (savingsByBook <= 0) {
    recommendation = isSimpleEligible ? "단순경비율 추계신고가 유리합니다." : "실제 경비 확인 후 장부신고를 권장합니다.";
  }

  return {
    revenue,
    priorRevenue,
    industryGroup,
    isSimpleEligible,
    isDoubleBookObligated,
    simple: {
      income: Math.round(simpleIncome),
      taxBase: Math.round(simpleTaxBase),
      rawTax: simpleRawTax,
      penalty: simplePenalty,
      totalTax: simpleTotalTax
    },
    standard: {
      income: Math.round(stdIncome),
      taxBase: Math.round(stdTaxBase),
      rawTax: stdRawTax,
      penalty: stdPenalty,
      totalTax: stdTotalTax
    },
    book: {
      income: Math.round(bookIncome),
      taxBase: Math.round(bookTaxBase),
      rawTax: bookRawTax,
      credit: bookCredit,
      totalTax: bookTotalTax
    },
    applicableEstimationTax,
    savingsByBook,
    recommendation
  };
}
