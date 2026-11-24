import { calculateNhisDependentStatus } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("nhis-form");
  if (!form) return;

  function update() {
    const params = {
      financialIncome: Number(document.getElementById("financialIncome").value) || 0,
      businessIncome: Number(document.getElementById("businessIncome").value) || 0,
      hasBusinessReg: document.getElementById("hasBusinessReg").checked,
      earnedIncome: Number(document.getElementById("earnedIncome").value) || 0,
      publicPension: Number(document.getElementById("publicPension").value) || 0,
      otherIncome: Number(document.getElementById("otherIncome").value) || 0,
      propertyTaxBase: Number(document.getElementById("propertyTaxBase").value) || 0,
      isMarried: document.getElementById("isMarried").checked,
      spouseFailed: document.getElementById("spouseFailed").checked
    };

    const res = calculateNhisDependentStatus(params);

    const statusBadge = document.getElementById("res-status-badge");
    const statusDesc = document.getElementById("res-status-desc");
    const reasonsBox = document.getElementById("res-reasons-box");
    const reasonsList = document.getElementById("res-reasons-list");
    const monthlyTotal = document.getElementById("res-monthly-total");
    const annualTotal = document.getElementById("res-annual-total");
    const countedIncome = document.getElementById("res-counted-income");
    const financialTrapAlert = document.getElementById("financial-trap-alert");
    const savingsBox = document.getElementById("res-savings-box");
    const savingsAmount = document.getElementById("res-savings-amount");

    if (res.isPass) {
      statusBadge.textContent = "피부양자 자격 유지 (합격)";
      statusBadge.className = "badge badge-pass";
      statusDesc.textContent = "현재 입력하신 소득과 재산 조건으로는 건강보험 피부양자 자격이 안전하게 유지됩니다. 월 건강보험료는 0원입니다.";
      reasonsBox.style.display = "none";
    } else {
      statusBadge.textContent = "피부양자 탈락 (지역가입자 전환)";
      statusBadge.className = "badge badge-fail";
      statusDesc.textContent = "주의! 2026년 기준 피부양자 인정 요건을 초과하여 지역가입자로 전환될 위험이 있습니다.";
      reasonsBox.style.display = "block";
      reasonsList.innerHTML = "";
      res.disqualificationReasons.forEach(r => {
        const li = document.createElement("li");
        li.textContent = r;
        reasonsList.appendChild(li);
      });
    }

    countedIncome.textContent = Math.round(res.totalCountedIncome).toLocaleString() + "원";
    monthlyTotal.textContent = Math.round(res.totalMonthlyNhis).toLocaleString() + "원 / 월";
    annualTotal.textContent = Math.round(res.totalAnnualNhis).toLocaleString() + "원 / 연";

    if (res.isFinancialTrap) {
      financialTrapAlert.style.display = "block";
    } else {
      financialTrapAlert.style.display = "none";
    }

    if (res.potentialSavings > 0) {
      savingsBox.style.display = "block";
      savingsAmount.textContent = Math.round(res.potentialSavings).toLocaleString() + "원";
    } else {
      savingsBox.style.display = "none";
    }
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
