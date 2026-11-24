import { calculateOneHouseCgt } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("cgt-form");
  if (!form) return;

  function update() {
    const params = {
      salePrice: Number(document.getElementById("salePrice").value) || 0,
      acquisitionPrice: Number(document.getElementById("acquisitionPrice").value) || 0,
      necessaryExpenses: Number(document.getElementById("necessaryExpenses").value) || 0,
      holdingYears: Number(document.getElementById("holdingYears").value) || 0,
      residencyYears: Number(document.getElementById("residencyYears").value) || 0,
      isOneHouse: document.getElementById("isOneHouse").checked
    };

    const res = calculateOneHouseCgt(params);

    const badge = document.getElementById("res-tax-badge");
    const taxVal = document.getElementById("res-total-tax");
    const netGainVal = document.getElementById("res-net-gain");
    const taxableGainVal = document.getElementById("res-taxable-gain");
    const specialDeductionVal = document.getElementById("res-special-deduction");
    const deductionRateVal = document.getElementById("res-deduction-rate");
    const trapAlert = document.getElementById("residence-trap-alert");
    const trapDiff = document.getElementById("res-trap-diff");

    if (res.isFullyExempt) {
      badge.textContent = "12억 이하 1세대 1주택 전액 비과세 (세금 0원)";
      badge.className = "badge badge-exempt";
    } else if (res.isEligibleForTable2) {
      badge.textContent = `1주택 고가주택 장특공 ${(res.appliedSpecialDeductionRate * 100).toFixed(0)}% 최대 절세 적용`;
      badge.className = "badge badge-save";
    } else {
      badge.textContent = `표1 일반공제 ${(res.appliedSpecialDeductionRate * 100).toFixed(0)}% 적용`;
      badge.className = "badge badge-regular";
    }

    taxVal.textContent = Math.round(res.finalTotalTax).toLocaleString() + "원";
    netGainVal.textContent = Math.round(res.netGainAfterTax).toLocaleString() + "원";
    taxableGainVal.textContent = Math.round(res.taxableGain).toLocaleString() + "원";
    specialDeductionVal.textContent = Math.round(res.specialDeductionAmount).toLocaleString() + "원";
    deductionRateVal.textContent = (res.appliedSpecialDeductionRate * 100).toFixed(0) + "%";

    if (res.isResidenceTrap) {
      trapAlert.style.display = "block";
      const diff = res.taxUnderTable1 - res.finalTotalTax; // 실제로 2년 채웠을 때 줄어드는 세금
      // 표2 충족 시 세금 계산
      const potentialTable2 = calculateOneHouseCgt({ ...params, residencyYears: Math.max(2, params.residencyYears) });
      const potentialDiff = res.finalTotalTax - potentialTable2.finalTotalTax;
      trapDiff.textContent = Math.round(potentialDiff).toLocaleString() + "원";
    } else {
      trapAlert.style.display = "none";
    }
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
