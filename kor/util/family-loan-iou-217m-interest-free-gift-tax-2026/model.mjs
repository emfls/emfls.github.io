/**
 * Tool 473: 2026년 가족·부모님 간 차용증 무이자 한도(2억 1,739만 원) & 적정이자율 4.6% 증여세 계산기
 * Pure deterministic ESM module.
 */

export const STATUTORY_RATE = 0.046; // 4.6% 법정 적정이자율
export const MAX_INTEREST_DIFF_EXEMPTION = 10000000; // 연간 이자차액 1,000만 원 미만 비과세
export const ZERO_RATE_MAX_PRINCIPAL = 217391304; // 무이자 최대 원금 (2억 1,739만 1,304원)

export function calcFamilyLoanIou(params) {
  const principal = Math.max(0, parseFloat(params.principal) || 0);
  const agreedRatePercent = Math.max(0, Math.min(20, parseFloat(params.agreedRatePercent) || 0));
  const agreedRate = agreedRatePercent / 100;
  const loanTermYears = Math.max(1, parseInt(params.loanTermYears, 10) || 1);

  // 이자 차액 산정: 법정 적정이자 - 실제 지급이자 (원 미만 절사)
  const statutoryInterestAnnual = Math.floor(principal * STATUTORY_RATE);
  const agreedInterestAnnual = Math.floor(principal * agreedRate);
  const annualInterestDiff = Math.max(0, statutoryInterestAnnual - agreedInterestAnnual);

  // 상증세법 제41조의4: 이자 차액이 1,000만 원 미만인 경우 이자 증여세 비과세
  const isGiftTaxApplicable = annualInterestDiff >= MAX_INTEREST_DIFF_EXEMPTION;

  // 약정이자율별 비과세 최대 차용 가능 원금 역산
  // (0.046 - agreedRate) * Principal < 10,000,000
  let maxPrincipalExempt = Infinity;
  const rateDiff = STATUTORY_RATE - agreedRate;
  if (rateDiff > 0) {
    maxPrincipalExempt = Math.floor(9999999 / rateDiff);
  }

  // 증여세 과세표준 (1천만원 이상 시 차액 전액이 증여세 과세 대상)
  const annualDeemedGift = isGiftTaxApplicable ? Math.round(annualInterestDiff) : 0;
  const totalDeemedGift = annualDeemedGift * loanTermYears;

  // 예상 증여세 (직계존비속 10년 5천만원 기본공제 적용 후, 과표 1억 이하 10%, 누진세율)
  let estimatedTaxAnnual = 0;
  if (annualDeemedGift > 0) {
    if (annualDeemedGift <= 100000000) {
      estimatedTaxAnnual = annualDeemedGift * 0.10 * 0.97; // 3% 신고세액공제
    } else {
      estimatedTaxAnnual = (10000000 + (annualDeemedGift - 100000000) * 0.20) * 0.97;
    }
  }

  return {
    principal,
    agreedRatePercent,
    statutoryInterestAnnual: Math.round(statutoryInterestAnnual),
    agreedInterestAnnual: Math.round(agreedInterestAnnual),
    annualInterestDiff: Math.round(annualInterestDiff),
    isGiftTaxApplicable,
    maxPrincipalExempt,
    annualDeemedGift,
    totalDeemedGift,
    estimatedTaxAnnual: Math.round(estimatedTaxAnnual),
  };
}
