import { calculateSalaryTakeHome2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("salary-form");
  if (!form) return;

  function update() {
    const params = {
      annualSalary: Number(document.getElementById("annualSalary").value) || 0,
      nonTaxableMeal: Number(document.getElementById("nonTaxableMeal").value) || 200000,
      dependentsCount: Number(document.getElementById("dependentsCount").value) || 1,
      childrenCount: Number(document.getElementById("childrenCount").value) || 0
    };

    const res = calculateSalaryTakeHome2026(params);

    document.getElementById("res-monthly-takehome-2026").textContent = Math.round(res.monthlyTakeHome2026).toLocaleString() + "원 / 월";
    document.getElementById("res-annual-takehome-2026").textContent = Math.round(res.annualTakeHome2026).toLocaleString() + "원 / 연";

    document.getElementById("res-monthly-gross").textContent = Math.round(res.monthlyGross).toLocaleString() + "원";
    document.getElementById("res-total-deductions").textContent = Math.round(res.totalMonthlyDeductions2026).toLocaleString() + "원";

    document.getElementById("res-nps-2026").textContent = Math.round(res.monthlyNps2026).toLocaleString() + "원";
    document.getElementById("res-nhi-2026").textContent = Math.round(res.monthlyNhi2026).toLocaleString() + "원";
    document.getElementById("res-ltc-2026").textContent = Math.round(res.monthlyLtc2026).toLocaleString() + "원";
    document.getElementById("res-ei-2026").textContent = Math.round(res.monthlyEi2026).toLocaleString() + "원";
    document.getElementById("res-total-ins-2026").textContent = Math.round(res.totalMonthlyInsurance2026).toLocaleString() + "원";

    document.getElementById("res-tax-income").textContent = Math.round(res.monthlyIncomeTax).toLocaleString() + "원";
    document.getElementById("res-tax-local").textContent = Math.round(res.monthlyLocalTax).toLocaleString() + "원";
    document.getElementById("res-total-tax").textContent = Math.round(res.totalMonthlyTax).toLocaleString() + "원";

    // 2025 vs 2026 비교
    document.getElementById("res-monthly-ins-diff").textContent = "+" + Math.round(res.monthlyInsuranceIncrease).toLocaleString() + "원 / 월";
    document.getElementById("res-annual-ins-diff").textContent = "+" + Math.round(res.annualInsuranceIncrease).toLocaleString() + "원 / 연";
    document.getElementById("res-monthly-takehome-diff").textContent = Math.round(res.monthlyTakeHomeDiff).toLocaleString() + "원 / 월";

    // SVG Bar Chart 업데이트
    const maxVal = Math.max(res.totalMonthlyDeductions2026, res.monthlyTakeHome2026, 1);
    const takeHomeBarW = Math.min(260, Math.round((res.monthlyTakeHome2026 / maxVal) * 260));
    const dedBarW = Math.min(260, Math.round((res.totalMonthlyDeductions2026 / maxVal) * 260));
    
    const barTakeHome = document.getElementById("bar-takehome");
    const barDed = document.getElementById("bar-deduction");
    if (barTakeHome) barTakeHome.setAttribute("width", Math.max(10, takeHomeBarW));
    if (barDed) barDed.setAttribute("width", Math.max(10, dedBarW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
