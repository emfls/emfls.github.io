/**
 * Tool 475: 2026년 ISA 만기 60일 연금계좌 이전 추가 세액공제 +300만 원 계산기
 * Pure deterministic ESM module.
 */

export const BASE_PENSION_SAVING_LIMIT = 6000000; // 연금저축 단독 한도 600만 원
export const BASE_COMBINED_LIMIT = 9000000;       // 연금저축+IRP 합산 기본한도 900만 원
export const ISA_TRANSFER_RATE = 0.10;           // ISA 전환금액의 10%
export const ISA_ADDITIONAL_LIMIT = 3000000;     // ISA 추가 세액공제 최대 300만 원
export const MAX_TOTAL_DEDUCTION_LIMIT = 12000000; // 합산 최대 공제 1,200만 원

export const TAX_RATE_LOW_INCOME = 0.165;  // 총급여 5,500만 원 이하: 16.5%
export const TAX_RATE_HIGH_INCOME = 0.132; // 총급여 5,500만 원 초과: 13.2%

/**
 * ISA 만기 연금계좌 이전 및 세액공제 계산
 * @param {Object} params
 * @param {number} params.isaTransferAmount ISA 만기 연금계좌 전환 금액 (원)
 * @param {number} params.pensionSavingContribution 당해 연금저축 납입액 (원)
 * @param {number} params.irpContribution 당해 IRP 납입액 (원)
 * @param {number} params.annualSalary 총급여액 (원, 기본 50000000)
 */
export function calcIsaPensionTransfer(params) {
  const isaTransferAmount = Math.max(0, parseFloat(params.isaTransferAmount) || 0);
  const pensionSavingContribution = Math.max(0, parseFloat(params.pensionSavingContribution) || 0);
  const irpContribution = Math.max(0, parseFloat(params.irpContribution) || 0);
  const annualSalary = Math.max(0, parseFloat(params.annualSalary) || 50000000);

  // 1. 기본 연금계좌 세액공제 대상 금액 계산 (연금저축 최대 600만 + IRP 합산 최대 900만)
  const eligiblePensionSaving = Math.min(pensionSavingContribution, BASE_PENSION_SAVING_LIMIT);
  const remainingBaseLimit = Math.max(0, BASE_COMBINED_LIMIT - eligiblePensionSaving);
  const eligibleIrp = Math.min(irpContribution, remainingBaseLimit);
  const baseEligibleTotal = eligiblePensionSaving + eligibleIrp;

  // 2. ISA 전환 추가 세액공제 대상 금액 계산 (전환액의 10%, 최대 300만 원)
  const isaCalculatedDeduction = isaTransferAmount * ISA_TRANSFER_RATE;
  const eligibleIsaDeduction = Math.min(isaCalculatedDeduction, ISA_ADDITIONAL_LIMIT);

  // 3. 총 세액공제 대상 합산액 (최대 1,200만 원)
  const totalDeductionBase = baseEligibleTotal + eligibleIsaDeduction;

  // 4. 적용 세액공제율 판정
  const isLowIncome = annualSalary <= 55000000;
  const applicableRate = isLowIncome ? TAX_RATE_LOW_INCOME : TAX_RATE_HIGH_INCOME;

  // 5. 환급 세액 산출
  const baseTaxRefund = Math.round(baseEligibleTotal * applicableRate);
  const isaTaxRefund = Math.round(eligibleIsaDeduction * applicableRate);
  const totalTaxRefund = Math.round(totalDeductionBase * applicableRate);

  // 6. 만기 3,000만 원 이상 시 300만 원 상한 도달 여부
  const isIsaCapReached = isaTransferAmount >= 30000000;

  return {
    isaTransferAmount,
    pensionSavingContribution,
    irpContribution,
    annualSalary,
    baseEligibleTotal,
    eligibleIsaDeduction,
    totalDeductionBase,
    isLowIncome,
    applicableRate,
    baseTaxRefund,
    isaTaxRefund,
    totalTaxRefund,
    isIsaCapReached
  };
}
