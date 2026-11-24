import { calculateSeveranceTaxExact2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("severance-calc-form");
  if (!form) return;

  function update() {
    const last3MonthsSalary = Number(document.getElementById("last3MonthsSalary").value) || 0;
    const annualBonus = Number(document.getElementById("annualBonus").value) || 0;
    const unusedAnnualLeavePay = Number(document.getElementById("unusedAnnualLeavePay").value) || 0;
    const threeMonthsDays = Number(document.getElementById("threeMonthsDays").value) || 92;
    const totalTenureDays = Number(document.getElementById("totalTenureDays").value) || 0;

    const res = calculateSeveranceTaxExact2026({
      last3MonthsSalary,
      annualBonus,
      unusedAnnualLeavePay,
      threeMonthsDays,
      totalTenureDays
    });

    document.getElementById("res-daily-wage").textContent = res.dailyAverageWage.toLocaleString() + "원";
    document.getElementById("res-gross-severance").textContent = res.severancePay.toLocaleString() + "원";
    document.getElementById("res-service-years").textContent = res.serviceYears + "년 (재직 " + res.totalTenureDays.toLocaleString() + "일)";
    document.getElementById("res-service-deduction").textContent = res.serviceDeduction.toLocaleString() + "원 공제";

    document.getElementById("res-converted-salary").textContent = res.convertedSalary.toLocaleString() + "원";
    document.getElementById("res-converted-deduction").textContent = res.convertedSalaryDeduction.toLocaleString() + "원";
    document.getElementById("res-tax-base").textContent = res.taxBase.toLocaleString() + "원";

    document.getElementById("res-national-tax").textContent = res.nationalTax.toLocaleString() + "원";
    document.getElementById("res-local-tax").textContent = res.localTax.toLocaleString() + "원";
    document.getElementById("res-total-tax").textContent = res.totalTax.toLocaleString() + "원";
    document.getElementById("res-effective-rate").textContent = res.effectiveTaxRate + "%";
    document.getElementById("res-net-lump-sum").textContent = res.netLumpSum.toLocaleString() + "원";

    // IRP
    document.getElementById("res-irp-10yr-tax").textContent = res.irpTax10Yr.toLocaleString() + "원 (30% 절세: " + res.irpSaving10Yr.toLocaleString() + "원)";
    document.getElementById("res-irp-over10yr-tax").textContent = res.irpTaxOver10Yr.toLocaleString() + "원 (40% 절세: " + res.irpSavingOver10Yr.toLocaleString() + "원)";

    // Badge
    const badge = document.getElementById("res-rate-badge");
    if (badge) {
      if (res.effectiveTaxRate <= 5) {
        badge.textContent = `초저율 퇴직세율: 실효 ${res.effectiveTaxRate}% (매우 유리)`;
        badge.className = "badge badge-success";
      } else if (res.effectiveTaxRate <= 12) {
        badge.textContent = `표준 퇴직세율: 실효 ${res.effectiveTaxRate}%`;
        badge.className = "badge badge-info";
      } else {
        badge.textContent = `고액퇴직소득: 실효 ${res.effectiveTaxRate}% (IRP 수령 강력 추천)`;
        badge.className = "badge badge-warning";
      }
    }

    // SVG Chart
    const maxVal = Math.max(res.severancePay, 1);
    const grossW = 260;
    const netW = Math.max(10, Math.round((res.netLumpSum / maxVal) * 260));
    const taxW = Math.max(4, Math.round((res.totalTax / maxVal) * 260));

    const barGross = document.getElementById("chart-bar-gross");
    const barNet = document.getElementById("chart-bar-net");
    const barTax = document.getElementById("chart-bar-tax");

    if (barGross) barGross.setAttribute("width", grossW.toString());
    if (barNet) barNet.setAttribute("width", netW.toString());
    if (barTax) barTax.setAttribute("width", taxW.toString());

    const txtGross = document.getElementById("chart-txt-gross");
    const txtNet = document.getElementById("chart-txt-net");
    const txtTax = document.getElementById("chart-txt-tax");

    if (txtGross) txtGross.textContent = res.severancePay.toLocaleString() + "원";
    if (txtNet) txtNet.textContent = res.netLumpSum.toLocaleString() + "원";
    if (txtTax) txtTax.textContent = res.totalTax.toLocaleString() + "원 (" + res.effectiveTaxRate + "%)";
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
