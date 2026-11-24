/**
 * 2026~2027년 다주택자 양도소득세 중과 vs 세제개편안 완화 비교 모델
 */

export function calculateBasicIncomeTax(taxableBase) {
  if (taxableBase <= 0) return 0;
  if (taxableBase <= 14000000) {
    return Math.floor(taxableBase * 0.06);
  } else if (taxableBase <= 50000000) {
    return Math.floor(taxableBase * 0.15) - 1260000;
  } else if (taxableBase <= 88000000) {
    return Math.floor(taxableBase * 0.24) - 5760000;
  } else if (taxableBase <= 150000000) {
    return Math.floor(taxableBase * 0.35) - 15440000;
  } else if (taxableBase <= 300000000) {
    return Math.floor(taxableBase * 0.38) - 19940000;
  } else if (taxableBase <= 500000000) {
    return Math.floor(taxableBase * 0.40) - 25940000;
  } else if (taxableBase <= 1000000000) {
    return Math.floor(taxableBase * 0.42) - 35940000;
  } else {
    return Math.floor(taxableBase * 0.45) - 65940000;
  }
}

export function calculateMultiHouseTax2026(params) {
  const sellingPrice = Math.max(0, params.sellingPrice !== undefined ? Number(params.sellingPrice) || 0 : 1200000000);
  const acquisitionPrice = Math.max(0, params.acquisitionPrice !== undefined ? Number(params.acquisitionPrice) || 0 : 700000000);
  const necessaryExpenses = Math.max(0, params.necessaryExpenses !== undefined ? Number(params.necessaryExpenses) || 0 : 20000000);
  const holdingYears = Math.max(0, params.holdingYears !== undefined ? Number(params.holdingYears) || 0 : 5);
  const houseCount = params.houseCount !== undefined ? (Number(params.houseCount) >= 3 ? 3 : 2) : 2;
  const isAdjustedArea = params.isAdjustedArea !== undefined ? Boolean(params.isAdjustedArea) : true;

  // 양도차익
  const capitalGain = Math.max(0, sellingPrice - acquisitionPrice - necessaryExpenses);

  // 1. 시나리오 A: 유예 상태 (기본세율 + 장특공 일반 최대 30%)
  const holdingDeductionRate = holdingYears >= 3 ? Math.min(0.30, holdingYears * 0.02) : 0;
  const deductionA = Math.floor(capitalGain * holdingDeductionRate);
  const baseA = Math.max(0, capitalGain - deductionA - 2500000);
  const basicTaxA = calculateBasicIncomeTax(baseA);
  const totalTaxA = Math.floor(basicTaxA * 1.1); // 지방소득세 10%

  // 2. 시나리오 B: 2026.8 세제개편안 (2027년 완화: 2주택 +5%p, 3주택+ +10%p, 장특공 배제)
  const rateSurchargeB = houseCount === 2 ? 0.05 : 0.10;
  const baseB = Math.max(0, capitalGain - 2500000);
  const surchargeTaxB = Math.floor(baseB * rateSurchargeB);
  const totalTaxB = Math.floor((calculateBasicIncomeTax(baseB) + surchargeTaxB) * 1.1);

  // 3. 시나리오 C: 2026.8 세제개편안 (2028년 완화: 2주택 +10%p, 3주택+ +15%p, 장특공 배제)
  const rateSurchargeC = houseCount === 2 ? 0.10 : 0.15;
  const baseC = Math.max(0, capitalGain - 2500000);
  const surchargeTaxC = Math.floor(baseC * rateSurchargeC);
  const totalTaxC = Math.floor((calculateBasicIncomeTax(baseC) + surchargeTaxC) * 1.1);

  // 4. 시나리오 D: 법정 중과 (2주택 +20%p, 3주택+ +30%p, 장특공 배제)
  const rateSurchargeD = houseCount === 2 ? 0.20 : 0.30;
  const baseD = Math.max(0, capitalGain - 2500000);
  const surchargeTaxD = isAdjustedArea ? Math.floor(baseD * rateSurchargeD) : 0;
  const totalTaxD = Math.floor((calculateBasicIncomeTax(baseD) + surchargeTaxD) * 1.1);

  // 소급 환급 예상액 (법정 중과 대비 2027년 개편안 세액 차이)
  const refundDiff = Math.max(0, totalTaxD - totalTaxB);
  const suspensionDiff = Math.max(0, totalTaxD - totalTaxA);

  return {
    sellingPrice,
    acquisitionPrice,
    necessaryExpenses,
    holdingYears,
    houseCount,
    isAdjustedArea,
    capitalGain,
    holdingDeductionRate,
    scenarioA: { name: "중과유예(기본세율+장특공)", totalTax: totalTaxA },
    scenarioB: { name: "2027년 개편안(+5%/10%p)", totalTax: totalTaxB, rateSurcharge: rateSurchargeB },
    scenarioC: { name: "2028년 개편안(+10%/15%p)", totalTax: totalTaxC, rateSurcharge: rateSurchargeC },
    scenarioD: { name: "법정 중과(+20%/30%p)", totalTax: totalTaxD, rateSurcharge: rateSurchargeD },
    refundDiff,
    suspensionDiff
  };
}
