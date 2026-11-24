import { calculateOverseasStockTax } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("stock-form");
  if (!form) return;

  function update() {
    const params = {
      realizedGain: Number(document.getElementById("realizedGain").value) || 0,
      realizedLoss: Number(document.getElementById("realizedLoss").value) || 0,
      unrealizedLossToHarvest: Number(document.getElementById("unrealizedLossToHarvest").value) || 0,
      tradingFeeRate: Number(document.getElementById("tradingFeeRate").value) || 0.001,
      spouseGiftVal: Number(document.getElementById("spouseGiftVal").value) || 0,
      originalAcquisitionVal: Number(document.getElementById("originalAcquisitionVal").value) || 0,
      heldOverOneYear: document.getElementById("heldOverOneYear").checked
    };

    const res = calculateOverseasStockTax(params);

    document.getElementById("res-tax-current").textContent = Math.round(res.totalTaxCurrent).toLocaleString() + "원";
    document.getElementById("res-tax-after-harvest").textContent = Math.round(res.totalTaxAfterHarvest).toLocaleString() + "원";
    document.getElementById("res-tax-saved").textContent = Math.round(res.netTaxSaved).toLocaleString() + "원";

    const harvestBadge = document.getElementById("res-harvest-badge");
    const harvestDesc = document.getElementById("res-harvest-desc");
    if (res.netTaxSaved > 0) {
      harvestBadge.textContent = "연말 손익통산 절세 효과 유효";
      harvestBadge.className = "badge badge-save";
      harvestDesc.textContent = `평가손실 종목을 연말에 매도(필요 시 즉시 재매수)하여 내년 5월 납부할 양도소득세 ${Math.round(res.netTaxSaved).toLocaleString()}원을 즉시 절감할 수 있습니다.`;
    } else {
      harvestBadge.textContent = "기본 공제(250만 원) 이내 안전";
      harvestBadge.className = "badge badge-neutral";
      harvestDesc.textContent = "현재 순양도차익이 기본공제(250만 원) 이내이거나 추가 절세 여력이 없습니다.";
    }

    const spouseAlert = document.getElementById("spouse-carryover-alert");
    const spouseDesc = document.getElementById("spouse-alert-text");
    if (params.spouseGiftVal > 0) {
      spouseAlert.style.display = "block";
      spouseDesc.textContent = res.carryoverMessage;
      if (res.isCarryoverTrap) {
        spouseAlert.className = "loss-aversion-box";
      } else {
        spouseAlert.className = "loss-aversion-box alert-success";
      }
    } else {
      spouseAlert.style.display = "none";
    }

    document.getElementById("res-spouse-saved").textContent = Math.round(res.spouseTaxSaved).toLocaleString() + "원";
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
