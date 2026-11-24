import { calculateJeonseVsWolse } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("jw-form");
  if (!form) return;

  function update() {
    const params = {
      jeonseDeposit: Number(document.getElementById("jeonseDeposit").value) || 0,
      jeonseOwnFunds: Number(document.getElementById("jeonseOwnFunds").value) || 0,
      jeonseLoanRate: Number(document.getElementById("jeonseLoanRate").value) || 0,
      bokBaseRate: Number(document.getElementById("bokBaseRate").value) || 3.0,
      opportunityRate: Number(document.getElementById("opportunityRate").value) || 3.2,
      guaranteeFeeRate: Number(document.getElementById("guaranteeFeeRate").value) || 0.128,
      wolseDeposit: Number(document.getElementById("wolseDeposit").value) || 0,
      monthlyRent: Number(document.getElementById("monthlyRent").value) || 0,
      totalSalary: Number(document.getElementById("totalSalary").value) || 0,
      isHomelessHead: document.getElementById("isHomelessHead").checked,
      isEligibleHouse: document.getElementById("isEligibleHouse").checked
    };

    const res = calculateJeonseVsWolse(params);

    const recBadge = document.getElementById("res-rec-badge");
    const recSummary = document.getElementById("res-rec-summary");
    const monthlyJeonseCost = document.getElementById("res-monthly-jeonse-cost");
    const monthlyWolseCost = document.getElementById("res-monthly-wolse-cost");
    const monthlyDiff = document.getElementById("res-monthly-diff");
    const twoYearDiff = document.getElementById("res-two-year-diff");
    const legalRateVal = document.getElementById("res-legal-rate");
    const legalMaxRentVal = document.getElementById("res-legal-max-rent");
    const actualRateVal = document.getElementById("res-actual-rate");
    const taxRefundVal = document.getElementById("res-tax-refund");
    const legalAlert = document.getElementById("legal-rate-alert");

    legalRateVal.textContent = res.legalConversionRate.toFixed(2) + "%";
    legalMaxRentVal.textContent = Math.round(res.legalMaxMonthlyRent).toLocaleString() + "원 / 월";
    actualRateVal.textContent = res.actualConversionRate.toFixed(2) + "%";

    if (res.isLegalRateExceeded) {
      legalAlert.style.display = "block";
      document.getElementById("actual-rate-span").textContent = res.actualConversionRate.toFixed(2) + "%";
      document.getElementById("legal-rate-span").textContent = res.legalConversionRate.toFixed(2) + "%";
    } else {
      legalAlert.style.display = "none";
    }

    taxRefundVal.textContent = Math.round(res.annualTaxRefund).toLocaleString() + "원 / 연";

    monthlyJeonseCost.textContent = Math.round(res.totalMonthlyJeonseCost).toLocaleString() + "원 / 월";
    monthlyWolseCost.textContent = Math.round(res.totalMonthlyWolseCost).toLocaleString() + "원 / 월";

    if (res.recommendedPlan === "JEONSE") {
      recBadge.textContent = "전세 유리 (Plan A 추천)";
      recBadge.className = "badge badge-jeonse";
      recSummary.textContent = `전세 선택 시 월 ${Math.round(res.monthlyDifference).toLocaleString()}원, 2년 계약 동안 총 ${Math.round(res.twoYearDifference).toLocaleString()}원의 순주거비를 절약할 수 있습니다.`;
    } else {
      recBadge.textContent = "월세 유리 (Plan B 추천)";
      recBadge.className = "badge badge-wolse";
      recSummary.textContent = `월세 선택 시(세액공제 및 잉여자금 운용 반영) 월 ${Math.round(res.monthlyDifference).toLocaleString()}원, 2년 계약 동안 총 ${Math.round(res.twoYearDifference).toLocaleString()}원의 순주거비를 절약할 수 있습니다.`;
    }

    monthlyDiff.textContent = Math.round(res.monthlyDifference).toLocaleString() + "원";
    twoYearDiff.textContent = Math.round(res.twoYearDifference).toLocaleString() + "원";
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
