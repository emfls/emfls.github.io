/**
 * 2026년 해외주식 250만 원 기본공제, 연말 손익통산(Tax-Loss Harvesting) 및 배우자 증여(1년 이월과세) 계산 모델
 */

export function calculateOverseasStockTax(params) {
  const realizedGain = Math.max(0, Number(params.realizedGain) || 0);         // 올해 실현 확정 수익 (원)
  const realizedLoss = Math.max(0, Number(params.realizedLoss) || 0);         // 올해 실현 확정 손실 (원)
  const unrealizedLossToHarvest = Math.max(0, Number(params.unrealizedLossToHarvest) || 0); // 연말 추가 손실확정 예정액 (원)
  const tradingFeeRate = Math.max(0, Number(params.tradingFeeRate) || 0.001); // 왕복 매매수수료율 (기본 0.1%)
  
  const spouseGiftVal = Math.max(0, Number(params.spouseGiftVal) || 0);       // 배우자 증여 주식 평가액 (원, 한도 6억)
  const originalAcquisitionVal = Math.max(0, Number(params.originalAcquisitionVal) || 0); // 본인 최초 취득가액 (원)
  const heldOverOneYear = Boolean(params.heldOverOneYear);                    // 증여 후 1년 이상 보유 여부

  // 1. 현재 상태 세금 계산 (손익통산 전)
  const netRealizedCurrent = Math.max(0, realizedGain - realizedLoss);
  const taxBaseCurrent = Math.max(0, netRealizedCurrent - 2500000);
  const capitalGainsTaxCurrent = Math.round(taxBaseCurrent * 0.20);
  const localTaxCurrent = Math.round(taxBaseCurrent * 0.02);
  const totalTaxCurrent = capitalGainsTaxCurrent + localTaxCurrent; // 22%

  // 2. 연말 손익통산(Loss Harvesting) 실행 후 세금 계산
  const totalRealizedLossAfterHarvest = realizedLoss + unrealizedLossToHarvest;
  const netRealizedAfterHarvest = Math.max(0, realizedGain - totalRealizedLossAfterHarvest);
  const taxBaseAfterHarvest = Math.max(0, netRealizedAfterHarvest - 2500000);
  const capitalGainsTaxAfterHarvest = Math.round(taxBaseAfterHarvest * 0.20);
  const localTaxAfterHarvest = Math.round(taxBaseAfterHarvest * 0.02);
  const totalTaxAfterHarvest = capitalGainsTaxAfterHarvest + localTaxAfterHarvest;

  // 손익통산으로 즉시 절감되는 순 절세액
  const grossTaxSaved = Math.max(0, totalTaxCurrent - totalTaxAfterHarvest);
  // 매도 후 즉시 재매수 시 발생하는 매매수수료
  const harvestFeeCost = Math.round(unrealizedLossToHarvest * tradingFeeRate);
  const netTaxSaved = Math.max(0, grossTaxSaved - harvestFeeCost);

  // 3. 배우자 증여(10년 6억 원 비과세) 및 1년 이월과세(소득세법 제97조의2) 분석
  // 당초 평가이익 (증여가액 - 당초 취득가액)
  const giftCapitalGain = Math.max(0, spouseGiftVal - originalAcquisitionVal);
  const normalSaleTax = Math.round(Math.max(0, giftCapitalGain - 2500000) * 0.22); // 본인이 직접 팔았을 때 세금

  let spouseSaleTax = 0;
  let spouseTaxSaved = 0;
  let isCarryoverTrap = false;
  let carryoverMessage = "";

  if (spouseGiftVal > 0) {
    if (!heldOverOneYear) {
      // 1년 미만 매도 시: 이월과세 적용되어 증여자의 당초 취득가액으로 과세!
      isCarryoverTrap = true;
      spouseSaleTax = normalSaleTax;
      spouseTaxSaved = 0;
      carryoverMessage = "경고: 증여 후 1년 미만 매도 시 이월과세가 적용되어 당초 취득가액으로 22% 과세됩니다 (절세 효과 0원).";
    } else {
      // 1년 경과 후 매도 시: 증여가액이 새로운 취득가액으로 인정되어 양도차익 비과세!
      isCarryoverTrap = false;
      spouseSaleTax = 0; // 증여가액과 동일한 가격에 매도 가정
      spouseTaxSaved = normalSaleTax;
      carryoverMessage = `합법 절세: 1년 이상 보유 후 매도 시 증여가액이 취득가로 인정되어 양도세 ${normalSaleTax.toLocaleString()}원이 전액 절감됩니다.`;
    }
  }

  return {
    netRealizedCurrent,
    taxBaseCurrent,
    totalTaxCurrent,
    netRealizedAfterHarvest,
    taxBaseAfterHarvest,
    totalTaxAfterHarvest,
    grossTaxSaved,
    harvestFeeCost,
    netTaxSaved,
    giftCapitalGain,
    normalSaleTax,
    spouseSaleTax,
    spouseTaxSaved,
    isCarryoverTrap,
    carryoverMessage
  };
}
