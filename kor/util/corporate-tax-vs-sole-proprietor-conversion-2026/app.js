import { calculateCorpVsSoleProprietor2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("corp-calc-form");
  if (!form) return;

  function update() {
    const annualRevenue = Number(document.getElementById("annualRevenue").value) || 0;
    const netProfit = Number(document.getElementById("netProfit").value) || 0;
    const industryType = document.getElementById("industryType").value || "service";
    const ceoSalaryRatio = Number(document.getElementById("ceoSalaryRatio").value) || 50;

    const res = calculateCorpVsSoleProprietor2026({
      annualRevenue,
      netProfit,
      industryType,
      ceoSalaryRatio
    });

    document.getElementById("res-sole-tax").textContent = res.soleTotalIncomeTax.toLocaleString() + "원";
    document.getElementById("res-sole-nhis").textContent = res.soleHealthInsurance.toLocaleString() + "원";
    document.getElementById("res-sole-total").textContent = res.soleTotalBurden.toLocaleString() + "원";
    document.getElementById("res-sole-rate").textContent = res.soleEffectiveRate + "%";

    document.getElementById("res-corp-tax").textContent = res.corpTotalTax.toLocaleString() + "원";
    document.getElementById("res-ceo-tax").textContent = res.ceoTotalIncomeTax.toLocaleString() + "원";
    document.getElementById("res-ceo-nhis").textContent = res.ceoHealthInsurance.toLocaleString() + "원";
    document.getElementById("res-corp-total").textContent = res.corpTotalBurden.toLocaleString() + "원";
    document.getElementById("res-corp-rate").textContent = res.corpEffectiveRate + "%";

    const diffEl = document.getElementById("res-diff");
    if (res.taxSaving > 0) {
      diffEl.textContent = `법인 전환 시 연 ${res.taxSaving.toLocaleString()}원 절세 (추천)`;
      diffEl.className = "badge badge-success";
    } else {
      diffEl.textContent = `개인사업자 유지 시 연 ${Math.abs(res.taxSaving).toLocaleString()}원 유리`;
      diffEl.className = "badge badge-warning";
    }

    const faithfulEl = document.getElementById("res-faithful-alert");
    if (faithfulEl) {
      faithfulEl.textContent = res.faithfulNotice;
      if (res.isFaithfulReportingTarget) {
        faithfulEl.className = "alert-box alert-danger";
      } else if (res.faithfulRatioPercent >= 80) {
        faithfulEl.className = "alert-box alert-warning";
      } else {
        faithfulEl.className = "alert-box alert-info";
      }
    }

    // SVG Chart Update
    const maxVal = Math.max(res.soleTotalBurden, res.corpTotalBurden, 1);
    const soleW = Math.max(10, Math.round((res.soleTotalBurden / maxVal) * 260));
    const corpW = Math.max(10, Math.round((res.corpTotalBurden / maxVal) * 260));

    const soleBar = document.getElementById("chart-bar-sole");
    const corpBar = document.getElementById("chart-bar-corp");
    const soleText = document.getElementById("chart-txt-sole");
    const corpText = document.getElementById("chart-txt-corp");

    if (soleBar) soleBar.setAttribute("width", soleW.toString());
    if (corpBar) corpBar.setAttribute("width", corpW.toString());
    if (soleText) soleText.textContent = res.soleTotalBurden.toLocaleString() + "원 (" + res.soleEffectiveRate + "%)";
    if (corpText) corpText.textContent = res.corpTotalBurden.toLocaleString() + "원 (" + res.corpEffectiveRate + "%)";
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
