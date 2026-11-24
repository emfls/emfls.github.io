import { calculateMonthlyRentTaxCredit2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("rent-tax-form");
  if (!form) return;

  function update() {
    const salary = Number(document.getElementById("salary").value) || 45000000;
    const monthlyRent = Number(document.getElementById("monthlyRent").value) || 600000;
    const monthsPaid = Number(document.getElementById("monthsPaid").value) || 12;
    const isHomeless = document.getElementById("isHomeless").checked;
    const isEligibleHouse = document.getElementById("isEligibleHouse").checked;
    const hasResidentRegistration = document.getElementById("hasResidentRegistration").checked;
    const marginalTaxRate = Number(document.getElementById("marginalTaxRate").value) || 16.5;

    const res = calculateMonthlyRentTaxCredit2026({
      salary,
      monthlyRent,
      monthsPaid,
      isHomeless,
      isEligibleHouse,
      hasResidentRegistration,
      marginalTaxRate
    });

    document.getElementById("res-annual-rent").textContent = res.annualRentPaid.toLocaleString() + "원";
    document.getElementById("res-eligible-base").textContent = res.maxEligibleRentForCredit.toLocaleString() + "원 (한도 1,000만)";
    
    if (res.isCreditEligible) {
      document.getElementById("res-credit-rate").textContent = res.creditRatePercent + "% (총급여 " + (res.salary <= 55000000 ? "5,500만 이하" : "8,000만 이하") + ")";
      document.getElementById("res-credit-refund").textContent = res.rentCreditRefund.toLocaleString() + "원 환급";
      document.getElementById("res-credit-badge").textContent = "세액공제 적격 대상";
      document.getElementById("res-credit-badge").className = "badge badge-success";
    } else {
      document.getElementById("res-credit-rate").textContent = "0% (공제 대상 제외)";
      document.getElementById("res-credit-refund").textContent = "0원";
      document.getElementById("res-credit-badge").textContent = "세액공제 요건 미충족";
      document.getElementById("res-credit-badge").className = "badge badge-warning";
    }

    document.getElementById("res-cash-deduction").textContent = res.cashReceiptDeduction.toLocaleString() + "원 (30% 소득공제)";
    document.getElementById("res-cash-saving").textContent = res.cashReceiptTaxSaving.toLocaleString() + "원 절세 (세율 " + res.effectiveMarginalRate + "% 가정)";
    
    document.getElementById("res-recommended").textContent = res.recommendedMethod;
    document.getElementById("res-recommendation-detail").textContent = res.recommendationText;

    // Error box
    const errBox = document.getElementById("res-error-box");
    if (errBox) {
      if (!res.isCreditEligible && res.qualificationErrors.length > 0) {
        errBox.style.display = "block";
        errBox.textContent = "ℹ️ 세액공제 검토 사항: " + res.qualificationErrors.join(" / ");
      } else {
        errBox.style.display = "none";
      }
    }

    // Chart update
    const maxVal = Math.max(res.rentCreditRefund, res.cashReceiptTaxSaving, 100000);
    const creditW = Math.min(260, Math.round((res.rentCreditRefund / maxVal) * 260));
    const cashW = Math.min(260, Math.round((res.cashReceiptTaxSaving / maxVal) * 260));

    const barCredit = document.getElementById("bar-credit");
    const barCash = document.getElementById("bar-cash");
    if (barCredit) barCredit.setAttribute("width", Math.max(8, creditW));
    if (barCash) barCash.setAttribute("width", Math.max(8, cashW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
