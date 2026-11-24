/**
 * 2026년 1세대 1주택 12억 비과세 및 장기보유특별공제 최대 80% (표2 vs 표1 거주요건 함정) 계산 모델
 */

export function calculateOneHouseCgt(params) {
  const salePrice = Math.max(0, Number(params.salePrice) || 0);               // 양도가액 (원)
  const acquisitionPrice = Math.max(0, Number(params.acquisitionPrice) || 0); // 취득가액 (원)
  const necessaryExpenses = Math.max(0, Number(params.necessaryExpenses) || 0); // 필요경비 (취득세, 중개보수 등, 원)
  const holdingYears = Math.max(0, Math.floor(Number(params.holdingYears)) || 0); // 보유기간 (년)
  const residencyYears = Math.max(0, Math.floor(Number(params.residencyYears)) || 0); // 거주기간 (년)
  const isOneHouse = Boolean(params.isOneHouse);                              // 1세대 1주택 여부

  // 1. 전체 양도차익
  const totalGain = Math.max(0, salePrice - acquisitionPrice - necessaryExpenses);

  // 2. 12억 원 이하 비과세 판정
  // 1세대 1주택이고 양도가액 12억 이하인 경우 전액 비과세 (세금 0원)
  const isFullyExempt = isOneHouse && salePrice <= 1200000000;

  // 12억 초과 고가주택 과세대상 양도차익
  // 과세대상 차익 = 전체차익 * (양도가액 - 12억) / 양도가액
  let taxableGain = 0;
  if (!isOneHouse) {
    taxableGain = totalGain; // 다주택자는 12억 비과세 없음
  } else if (salePrice > 1200000000) {
    taxableGain = Math.round(totalGain * ((salePrice - 1200000000) / salePrice));
  }

  // 3. 장기보유특별공제율 계산
  // 표 2: 1세대 1주택 + 거주 2년 이상 (보유 연 4% 최대 40% + 거주 연 4% 최대 40% = 최대 80%)
  // 표 1: 거주 2년 미만 또는 일반 (3년 6% ~ 15년 30%, 연 2%)

  // 표 2 적용 가능 여부: 1세대 1주택 AND 3년 이상 보유 AND 2년 이상 거주
  const isEligibleForTable2 = isOneHouse && holdingYears >= 3 && residencyYears >= 2;

  let table2Rate = 0;
  if (isEligibleForTable2) {
    // 보유기간 공제율 (3년 12% ~ 10년 40%)
    const holdingRate = Math.min(0.40, holdingYears * 0.04);
    // 거주기간 공제율 (2년 8% ~ 10년 40%)
    const residencyRate = Math.min(0.40, residencyYears * 0.04);
    table2Rate = Math.min(0.80, Math.round((holdingRate + residencyRate) * 100) / 100);
  }

  // 표 1 공제율 (연 2%, 3년 6% ~ 15년 30%)
  let table1Rate = 0;
  if (holdingYears >= 3) {
    table1Rate = Math.min(0.30, Math.round((holdingYears * 0.02) * 100) / 100);
  }

  // 실제 적용되는 공제율
  const appliedSpecialDeductionRate = isEligibleForTable2 ? table2Rate : table1Rate;
  const specialDeductionAmount = Math.round(taxableGain * appliedSpecialDeductionRate);

  // 표 1 적용 시(거주 2년 미만 함정) 공제액
  const table1DeductionAmount = Math.round(taxableGain * table1Rate);

  // 4. 과세표준 및 세액 계산 헬퍼
  function computeTax(gain, deductionRate) {
    if (gain <= 0) return 0;
    const deduction = Math.round(gain * deductionRate);
    const incomeAfterDeduction = Math.max(0, gain - deduction);
    const taxBase = Math.max(0, incomeAfterDeduction - 2500000); // 기본공제 250만 원

    let tax = 0;
    if (taxBase <= 14000000) {
      tax = taxBase * 0.06;
    } else if (taxBase <= 50000000) {
      tax = 840000 + (taxBase - 14000000) * 0.15;
    } else if (taxBase <= 88000000) {
      tax = 6240000 + (taxBase - 50000000) * 0.24;
    } else if (taxBase <= 150000000) {
      tax = 15360000 + (taxBase - 88000000) * 0.35;
    } else if (taxBase <= 300000000) {
      tax = 37060000 + (taxBase - 150000000) * 0.38;
    } else if (taxBase <= 500000000) {
      tax = 94060000 + (taxBase - 300000000) * 0.40;
    } else if (taxBase <= 1000000000) {
      tax = 174060000 + (taxBase - 500000000) * 0.42;
    } else {
      tax = 384060000 + (taxBase - 1000000000) * 0.45;
    }
    const calculatedTax = Math.round(tax);
    const localTax = Math.round(calculatedTax * 0.10);
    return calculatedTax + localTax;
  }

  const finalTotalTax = isFullyExempt ? 0 : computeTax(taxableGain, appliedSpecialDeductionRate);
  // 거주 2년 미만 시(표 1 적용 시) 총 세금
  const taxUnderTable1 = isFullyExempt ? 0 : computeTax(taxableGain, table1Rate);

  // 거주요건 2년 충족으로 인한 절세 차액
  const residenceSavings = isEligibleForTable2 ? Math.max(0, taxUnderTable1 - finalTotalTax) : 0;
  // 거주요건 2년 미충족 시 발생하는 세금 폭탄 경고 여부
  const isResidenceTrap = isOneHouse && salePrice > 1200000000 && holdingYears >= 3 && residencyYears < 2;

  const netGainAfterTax = Math.max(0, totalGain - finalTotalTax);

  return {
    salePrice,
    acquisitionPrice,
    totalGain,
    isFullyExempt,
    taxableGain,
    isEligibleForTable2,
    table2Rate,
    table1Rate,
    appliedSpecialDeductionRate,
    specialDeductionAmount,
    finalTotalTax,
    taxUnderTable1,
    residenceSavings,
    isResidenceTrap,
    netGainAfterTax
  };
}
