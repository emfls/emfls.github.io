/**
 * 2026년 부동산 중개보수(복비) 상한요율, 월세 70배 예외 공식 및 부가세 모델
 */

export function calculateBrokerageFee2026(params) {
  const transactionType = params.transactionType || "sale";     // sale (매매·교환), rent (전세·월세)
  const propertyType = params.propertyType || "housing";        // housing (주택), officetel (주거용 오피스텔 <=85㎡), commercial (상가·토지 등)
  const depositOrPrice = params.depositOrPrice !== undefined ? Math.max(0, Number(params.depositOrPrice) || 0) : 500000000; // 매매가 또는 보증금 (원)
  const monthlyRent = Math.max(0, Number(params.monthlyRent) || 0);               // 월세 (원, 전세나 매매는 0)
  const vatType = params.vatType || "general";                                    // general (일반과세 10%), simplified (간이과세 4%), exempt (면세 0%)

  // 1. 거래가액 산정 (월세 임대차 환산보증금 예외 공식 적용)
  let transactionAmount = depositOrPrice;
  let is70MultiplierApplied = false;

  if (transactionType === "rent" && monthlyRent > 0) {
    // 1차: 보증금 + (월차임 * 100)
    const standardConverted = depositOrPrice + (monthlyRent * 100);
    if (standardConverted < 50000000) {
      // 5천만 원 미만일 경우 70배 적용 (공인중개사법 시행규칙 제20조 제5항)
      transactionAmount = depositOrPrice + (monthlyRent * 70);
      is70MultiplierApplied = true;
    } else {
      transactionAmount = standardConverted;
    }
  }

  // 2. 상한 요율 및 한도액 판정
  let maxRate = 0.004; // 기본
  let limitAmount = null; // 한도액 (없으면 null)

  if (propertyType === "housing") {
    if (transactionType === "sale") {
      // 주택 매매·교환
      if (transactionAmount < 50000000) {
        maxRate = 0.006;
        limitAmount = 250000;
      } else if (transactionAmount < 200000000) {
        maxRate = 0.005;
        limitAmount = 800000;
      } else if (transactionAmount < 900000000) {
        maxRate = 0.004;
      } else if (transactionAmount < 1200000000) {
        maxRate = 0.005;
      } else if (transactionAmount < 1500000000) {
        maxRate = 0.006;
      } else {
        maxRate = 0.007;
      }
    } else {
      // 주택 임대차 (전세·월세)
      if (transactionAmount < 50000000) {
        maxRate = 0.005;
        limitAmount = 200000;
      } else if (transactionAmount < 100000000) {
        maxRate = 0.004;
        limitAmount = 300000;
      } else if (transactionAmount < 600000000) {
        maxRate = 0.003;
      } else if (transactionAmount < 1200000000) {
        maxRate = 0.004;
      } else if (transactionAmount < 1500000000) {
        maxRate = 0.005;
      } else {
        maxRate = 0.006;
      }
    }
  } else if (propertyType === "officetel") {
    // 주거용 오피스텔 (전용 85㎡ 이하)
    if (transactionType === "sale") {
      maxRate = 0.005;
    } else {
      maxRate = 0.004;
    }
  } else {
    // 상가, 토지, 근린생활시설, 업무용 오피스텔 (0.9% 이내 협의)
    maxRate = 0.009;
  }

  // 3. 법정 중개수수료 본액 (한도액 적용)
  let rawFee = Math.floor(transactionAmount * maxRate);
  let isLimitApplied = false;
  if (limitAmount !== null && rawFee > limitAmount) {
    rawFee = limitAmount;
    isLimitApplied = true;
  }

  // 4. 부가가치세 (VAT)
  let vatRate = 0.10;
  if (vatType === "simplified") {
    vatRate = 0.04;
  } else if (vatType === "exempt") {
    vatRate = 0;
  }
  const vatAmount = Math.floor(rawFee * vatRate);
  const totalPayableFee = rawFee + vatAmount;

  return {
    transactionType,
    propertyType,
    depositOrPrice,
    monthlyRent,
    transactionAmount,
    is70MultiplierApplied,
    maxRate,
    maxRatePercent: Number((maxRate * 100).toFixed(2)),
    limitAmount,
    isLimitApplied,
    rawFee,
    vatType,
    vatRate,
    vatAmount,
    totalPayableFee
  };
}
