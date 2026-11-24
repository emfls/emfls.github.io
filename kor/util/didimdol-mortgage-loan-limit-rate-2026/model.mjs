/**
 * Tool 478: 2026년 내집마련 디딤돌대출 한도·자격 판정 & 월 상환액 계산기
 * Pure deterministic ESM module.
 */

export const MAX_NET_ASSET_LIMIT = 511000000; // 2026년 디딤돌 순자산 기준: 5억 1,100만 원 이하

export const CRITERIA = {
  general: {
    name: '일반 무주택가구',
    maxLoanLimit: 200000000,     // 최대 2억 원
    maxAnnualIncome: 60000000,   // 부부합산 연소득 6,000만 원 이하
    maxHousePrice: 500000000,    // 주택가격 5억 원 이하
    baseRatePercent: 3.15        // 기준 금리 (연 3.15%)
  },
  first_home: {
    name: '생애최초 주택구입자',
    maxLoanLimit: 240000000,     // 최대 2.4억 원
    maxAnnualIncome: 70000000,   // 부부합산 연소득 7,000만 원 이하
    maxHousePrice: 500000000,    // 주택가격 5억 원 이하
    baseRatePercent: 2.85        // 우대 반영 평균 금리 (연 2.85%)
  },
  newlywed: {
    name: '신혼가구 (혼인 7년 이내 or 2자녀 이상)',
    maxLoanLimit: 320000000,     // 최대 3.2억 원
    maxAnnualIncome: 85000000,   // 부부합산 연소득 8,500만 원 이하
    maxHousePrice: 600000000,    // 주택가격 6억 원 이하 (신혼 특례)
    baseRatePercent: 2.45        // 신혼 특례 우대 금리 (연 2.45%)
  }
};

export const COMMERCIAL_MORTGAGE_RATE = 0.045; // 시중은행 주담대 비교 금리 연 4.5%

/**
 * 디딤돌대출 자격 판정 및 월 상환액 계산
 * @param {Object} params
 * @param {string} params.category 유형 ('general', 'first_home', 'newlywed')
 * @param {number} params.annualIncome 부부합산 연소득 (원)
 * @param {number} params.housePrice 대상 주택 가격 (원)
 * @param {number} params.netAsset 순자산가액 (원)
 * @param {number} params.desiredLoanAmount 희망 대출 신청액 (원)
 * @param {number} params.termYears 상환 기간 (년, 10/15/20/30)
 */
export function calcDidimdolLoan(params) {
  const categoryKey = params.category && CRITERIA[params.category] ? params.category : 'general';
  const cfg = CRITERIA[categoryKey];

  const annualIncome = Math.max(0, parseFloat(params.annualIncome) || 0);
  const housePrice = Math.max(0, parseFloat(params.housePrice) || 0);
  const netAsset = Math.max(0, parseFloat(params.netAsset) || 0);
  const desiredLoanAmount = Math.max(0, parseFloat(params.desiredLoanAmount) || 0);
  const termYears = Math.max(10, Math.min(30, parseInt(params.termYears, 10) || 30));
  const termMonths = termYears * 12;

  // 1. 자격 심사 요건 판정
  const isIncomeEligible = annualIncome <= cfg.maxAnnualIncome;
  const isHousePriceEligible = housePrice <= cfg.maxHousePrice;
  const isNetAssetEligible = netAsset <= MAX_NET_ASSET_LIMIT;
  const isAllEligible = isIncomeEligible && isHousePriceEligible && isNetAssetEligible;

  // 2. 대출 한도 산정 (LTV 70% vs 법정 한도 vs 희망액)
  const ltvCap = housePrice * 0.70;
  const approvedLoanAmount = isAllEligible 
    ? Math.min(desiredLoanAmount, cfg.maxLoanLimit, ltvCap) 
    : 0;

  // 3. 월 상환액 (원리금 균등분할 상환)
  const monthlyDidimdolRate = (cfg.baseRatePercent / 100) / 12;
  let monthlyDidimdolPayment = 0;
  let totalDidimdolInterest = 0;

  if (approvedLoanAmount > 0 && monthlyDidimdolRate > 0) {
    monthlyDidimdolPayment = approvedLoanAmount * 
      (monthlyDidimdolRate * Math.pow(1 + monthlyDidimdolRate, termMonths)) /
      (Math.pow(1 + monthlyDidimdolRate, termMonths) - 1);
    totalDidimdolInterest = (monthlyDidimdolPayment * termMonths) - approvedLoanAmount;
  }

  // 4. 시중은행(4.5%) 대비 비교
  const monthlyCommercialRate = COMMERCIAL_MORTGAGE_RATE / 12;
  let monthlyCommercialPayment = 0;
  let totalCommercialInterest = 0;

  if (approvedLoanAmount > 0 && monthlyCommercialRate > 0) {
    monthlyCommercialPayment = approvedLoanAmount * 
      (monthlyCommercialRate * Math.pow(1 + monthlyCommercialRate, termMonths)) /
      (Math.pow(1 + monthlyCommercialRate, termMonths) - 1);
    totalCommercialInterest = (monthlyCommercialPayment * termMonths) - approvedLoanAmount;
  }

  const monthlySavings = Math.max(0, monthlyCommercialPayment - monthlyDidimdolPayment);
  const totalInterestSavings = Math.max(0, totalCommercialInterest - totalDidimdolInterest);

  return {
    categoryKey,
    categoryName: cfg.name,
    isIncomeEligible,
    isHousePriceEligible,
    isNetAssetEligible,
    isAllEligible,
    cfgMaxLimit: cfg.maxLoanLimit,
    approvedLoanAmount: Math.round(approvedLoanAmount),
    appliedRatePercent: cfg.baseRatePercent,
    termYears,
    monthlyDidimdolPayment: Math.round(monthlyDidimdolPayment),
    totalDidimdolInterest: Math.round(totalDidimdolInterest),
    monthlyCommercialPayment: Math.round(monthlyCommercialPayment),
    monthlySavings: Math.round(monthlySavings),
    totalInterestSavings: Math.round(totalInterestSavings)
  };
}
