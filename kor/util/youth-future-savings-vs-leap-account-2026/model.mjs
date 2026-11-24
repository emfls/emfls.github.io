/**
 * 2026년 신설 청년미래적금(3년) vs 청년도약계좌(5년) 만기 수령액 및 환산금리 모델
 */

export function calculateYouthFutureSavings2026(params) {
  const monthlyDeposit = Math.min(500000, Math.max(100000, Number(params.monthlyDeposit) || 500000));
  const incomeType = params.incomeType || "preferential"; // preferential (12%), standard (6%), tax_free_only (0%)
  const bankRatePercent = Math.max(1.0, Math.min(10.0, Number(params.bankRatePercent) || 5.0)); // 연 기본+우대금리 (기본 5.0%)
  const months = 36; // 3년 만기

  // 1. 총 납입 원금 (36개월)
  const totalPrincipal = monthlyDeposit * months;

  // 2. 은행 적금 이자 (단리 적수 계산: 원금 * r * (n+1)/(2*12))
  // 36개월의 경우: (36 * 37) / 24 = 55.5
  const r = bankRatePercent / 100;
  const bankInterestPreTax = Math.floor(monthlyDeposit * r * ((months * (months + 1)) / 24));

  // 3. 정부기여금 매칭 (우대형 12%, 일반형 6%, 비과세전용 0%)
  let matchRate = 0;
  let monthlyMatch = 0;
  if (incomeType === "preferential") {
    matchRate = 0.12;
    monthlyMatch = Math.floor(monthlyDeposit * matchRate); // 월 최대 60,000원
  } else if (incomeType === "standard") {
    matchRate = 0.06;
    monthlyMatch = Math.floor(monthlyDeposit * matchRate); // 월 최대 30,000원
  } else {
    matchRate = 0;
    monthlyMatch = 0;
  }
  const totalGovernmentMatch = monthlyMatch * months;

  // 4. 이자소득세 비과세 혜택
  // 일반 시중 적금은 이자소득세 15.4%(소득세 14% + 지방세 1.4%) 과세
  const taxSaved = Math.floor(bankInterestPreTax * 0.154);
  const netBankInterest = bankInterestPreTax; // 비과세이므로 세전이자 = 세후이자

  // 5. 만기 총 수령액 & 순이익
  const totalPayout = totalPrincipal + netBankInterest + totalGovernmentMatch;
  const totalProfit = netBankInterest + totalGovernmentMatch;
  const netReturnPercent = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;

  // 6. 일반 시중 과세 적금 대비 연환산 수익률 (세전 환산 금리)
  // 일반 적금 세후수익 = 세전이자 * 0.846
  // 세전이자 = 총수익 / 0.846
  // 환산금리 = 세전이자 / (monthlyDeposit * 55.5) * 100
  const equivalentPreTaxInterest = totalProfit / (1 - 0.154);
  const equivalentBankRate = (equivalentPreTaxInterest / (monthlyDeposit * 55.5)) * 100;

  // 7. 기존 청년도약계좌 (5년 60개월 만기, 월 70만 원 납입 시) 비교 데이터
  // 5년 총원금 4,200만 원, 정부기여금 월 최대 33,000원(총 198만 원), 은행이자(연 5.5% 가정 시 약 580만 원)
  // 도약계좌 총 수령액 약 4,978만 원
  const leapPrincipal = 700000 * 60; // 42,000,000원
  const leapMatch = 33000 * 60;      // 1,980,000원
  const leapInterest = Math.floor(700000 * 0.055 * ((60 * 61) / 24)); // 5,871,250원
  const leapPayout = leapPrincipal + leapMatch + leapInterest;

  return {
    monthlyDeposit,
    incomeType,
    bankRatePercent,
    months,
    totalPrincipal,
    bankInterestPreTax,
    matchRate,
    matchPercent: Math.round(matchRate * 100),
    monthlyMatch,
    totalGovernmentMatch,
    taxSaved,
    totalPayout,
    totalProfit,
    netReturnPercent: Number(netReturnPercent.toFixed(2)),
    equivalentBankRate: Number(equivalentBankRate.toFixed(2)),
    leapPrincipal,
    leapPayout
  };
}
