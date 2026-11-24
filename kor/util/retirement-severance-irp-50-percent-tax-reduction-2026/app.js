import { calculateRetirementTax } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("retire-form");
  if (!form) return;

  function update() {
    const params = {
      severancePay: Number(document.getElementById("severancePay").value) || 0,
      serviceYears: Number(document.getElementById("serviceYears").value) || 1
    };

    const res = calculateRetirementTax(params);

    document.getElementById("res-lump-tax").textContent = Math.round(res.totalLumpSumTax).toLocaleString() + "원";
    document.getElementById("res-lump-net").textContent = Math.round(res.lumpSumNetPayout).toLocaleString() + "원";
    document.getElementById("res-effective-rate").textContent = res.effectiveTaxRate.toFixed(2) + "%";

    document.getElementById("res-service-deduction").textContent = Math.round(res.serviceDeduction).toLocaleString() + "원";
    document.getElementById("res-converted-salary").textContent = Math.round(res.convertedSalary).toLocaleString() + "원";
    document.getElementById("res-tax-base").textContent = Math.round(res.taxBase).toLocaleString() + "원";

    document.getElementById("res-tax-10y").textContent = Math.round(res.tax10YearAnnuity).toLocaleString() + "원";
    document.getElementById("res-saved-10y").textContent = Math.round(res.savings10Year).toLocaleString() + "원";

    document.getElementById("res-tax-20y").textContent = Math.round(res.tax20YearAnnuity).toLocaleString() + "원";
    document.getElementById("res-saved-20y").textContent = Math.round(res.savings20Year).toLocaleString() + "원";

    document.getElementById("res-tax-25y").textContent = Math.round(res.tax25YearAnnuity).toLocaleString() + "원";
    document.getElementById("res-saved-25y").textContent = Math.round(res.savings25Year).toLocaleString() + "원";

    document.getElementById("highlight-max-savings").textContent = Math.round(res.savings25Year).toLocaleString() + "원";
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
