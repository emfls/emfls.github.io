import { calculateInheritanceTax2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("inherit-form");
  if (!form) return;

  function update() {
    const params = {
      totalEstate: Number(document.getElementById("totalEstate").value) || 0,
      debtsAndExpenses: Number(document.getElementById("debtsAndExpenses").value) || 0,
      netFinancialAssets: Number(document.getElementById("netFinancialAssets").value) || 0,
      hasSpouse: document.getElementById("hasSpouse").checked,
      isSpouseSoleHeir: document.getElementById("isSpouseSoleHeir").checked,
      childrenCount: Number(document.getElementById("childrenCount").value) || 0,
      actualSpouseInherited: Number(document.getElementById("actualSpouseInherited").value) || 0
    };

    const res = calculateInheritanceTax2026(params);

    document.getElementById("res-final-tax").textContent = Math.round(res.finalInheritanceTax).toLocaleString() + "원";
    document.getElementById("res-tax-base").textContent = Math.round(res.taxBase).toLocaleString() + "원";
    document.getElementById("res-total-deductions").textContent = Math.round(res.totalDeductions).toLocaleString() + "원";

    const badge = document.getElementById("res-badge");
    if (res.isZeroTax) {
      badge.textContent = "상속세 0원 (전액 공제 비과세)";
      badge.className = "badge badge-exempt";
    } else {
      badge.textContent = "상속세 과세 대상";
      badge.className = "badge badge-taxable";
    }

    document.getElementById("res-general-deduction").textContent = Math.round(res.generalDeduction).toLocaleString() + "원";
    document.getElementById("res-spouse-deduction").textContent = Math.round(res.spouseDeduction).toLocaleString() + "원";
    document.getElementById("res-financial-deduction").textContent = Math.round(res.financialDeduction).toLocaleString() + "원";
    document.getElementById("res-report-credit").textContent = "-" + Math.round(res.reportCredit).toLocaleString() + "원";

    const soleAlert = document.getElementById("spouse-sole-alert");
    if (res.isLumpSumDisallowed) {
      soleAlert.style.display = "block";
    } else {
      soleAlert.style.display = "none";
    }
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
