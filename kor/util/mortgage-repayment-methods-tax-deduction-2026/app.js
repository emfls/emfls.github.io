import { calculateMortgage2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("mortgage-form");
  if (!form) return;

  function update() {
    const principal = Number(document.getElementById("principal").value) || 300000000;
    const annualRate = Number(document.getElementById("annualRate").value) || 4.2;
    const termYears = Number(document.getElementById("termYears").value) || 30;
    const marginalTaxRate = Number(document.getElementById("marginalTaxRate").value) || 0.15;
    const deductionType = document.getElementById("deductionType").value;
    const propertyBaseValue = Number(document.getElementById("propertyBaseValue").value) || 500000000;

    const res = calculateMortgage2026({
      principal,
      annualRate,
      termYears,
      marginalTaxRate,
      deductionType,
      propertyBaseValue
    });

    document.getElementById("res-level-monthly").textContent = res.levelMonthlyPayment.toLocaleString() + "원 / 월";
    document.getElementById("res-level-interest").textContent = res.levelTotalInterest.toLocaleString() + "원";
    document.getElementById("res-equal-first").textContent = res.equalPrincFirstMonth.toLocaleString() + "원 (첫달)";
    document.getElementById("res-equal-interest").textContent = res.equalPrincTotalInterest.toLocaleString() + "원";
    document.getElementById("res-saving").textContent = "-" + res.interestSavedByEqualPrinc.toLocaleString() + "원 절감 (원금균등 선택 시)";

    document.getElementById("res-graduated-first").textContent = res.graduatedFirstMonth.toLocaleString() + "원 (초기부담 최저)";
    document.getElementById("res-graduated-interest").textContent = res.graduatedTotalInterest.toLocaleString() + "원";

    // 소득공제 환급액
    document.getElementById("res-refund").textContent = "+" + res.expectedTaxRefund.toLocaleString() + "원 환급 (첫해 연말정산)";
    document.getElementById("res-deduction-cap").textContent = (res.deductionCap / 10000).toLocaleString() + "만 원 한도 (" + (res.isEligibleProperty ? "기준시가 6억 이하 충족" : "기준시가 6억 초과 배제") + ")";

    // SVG Bar Chart 업데이트 (총 이자 비교)
    const maxVal = Math.max(res.graduatedTotalInterest, res.levelTotalInterest, res.equalPrincTotalInterest, 1);
    const eqW = Math.round((res.equalPrincTotalInterest / maxVal) * 260);
    const lvW = Math.round((res.levelTotalInterest / maxVal) * 260);
    const grW = Math.round((res.graduatedTotalInterest / maxVal) * 260);

    const barEq = document.getElementById("bar-equal");
    const barLv = document.getElementById("bar-level");
    const barGr = document.getElementById("bar-graduated");
    if (barEq) barEq.setAttribute("width", Math.max(10, eqW));
    if (barLv) barLv.setAttribute("width", Math.max(10, lvW));
    if (barGr) barGr.setAttribute("width", Math.max(10, grW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
