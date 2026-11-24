import { calculateBeotimmok2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("beotimmok-form");
  if (!form) return;

  function update() {
    const programType = document.getElementById("programType").value;
    const depositAmount = Number(document.getElementById("depositAmount").value) || 200000000;
    const requestedLoan = Number(document.getElementById("requestedLoan").value) || 150000000;
    const annualIncome = Number(document.getElementById("annualIncome").value) || 40000000;
    const isDualIncome = document.getElementById("isDualIncome").checked;
    const isUnder25Single = document.getElementById("isUnder25Single").checked;
    const region = document.getElementById("region").value;
    const commercialBankRate = Number(document.getElementById("commercialBankRate").value) || 4.3;

    // 프로그램별 필드 보이기/숨기기
    const youthSingleRow = document.getElementById("youth-single-row");
    const newbornDualRow = document.getElementById("newborn-dual-row");
    if (youthSingleRow) youthSingleRow.style.display = programType === "youth" ? "flex" : "none";
    if (newbornDualRow) newbornDualRow.style.display = programType === "newborn" ? "flex" : "none";

    const res = calculateBeotimmok2026({
      programType,
      depositAmount,
      requestedLoan,
      annualIncome,
      isDualIncome,
      isUnder25Single,
      region,
      commercialBankRate
    });

    document.getElementById("res-final-loan").textContent = (res.finalLoanAmount / 100000000).toFixed(2) + "억 원 (" + res.finalLoanAmount.toLocaleString() + "원)";
    document.getElementById("res-interest-rate").textContent = "연 " + res.applicableRate + "%";
    document.getElementById("res-monthly-interest").textContent = res.monthlyPolicyInterest.toLocaleString() + "원 / 월";
    document.getElementById("res-monthly-saving").textContent = "월 " + res.monthlyInterestSaving.toLocaleString() + "원 절감";
    document.getElementById("res-two-year-saving").textContent = res.twoYearSaving.toLocaleString() + "원 절감 (2년 계약)";
    document.getElementById("res-bank-interest").textContent = res.monthlyCommercialInterest.toLocaleString() + "원 / 월 (시중 " + res.commercialBankRate + "%)";

    // 에러 표시
    const errBox = document.getElementById("res-error-box");
    if (errBox) {
      if (!res.isEligible && res.qualificationErrors.length > 0) {
        errBox.style.display = "block";
        errBox.textContent = "⚠️ 자격 조건 검토 필요: " + res.qualificationErrors.join(" / ");
      } else {
        errBox.style.display = "none";
      }
    }

    // SVG Bar Chart 업데이트 (시중은행 vs 정책대출 월 이자)
    const maxVal = Math.max(res.monthlyCommercialInterest, res.monthlyPolicyInterest, 1);
    const bankW = Math.min(260, Math.round((res.monthlyCommercialInterest / maxVal) * 260));
    const policyW = Math.min(260, Math.round((res.monthlyPolicyInterest / maxVal) * 260));

    const barBank = document.getElementById("bar-bank");
    const barPolicy = document.getElementById("bar-policy");
    if (barBank) barBank.setAttribute("width", Math.max(10, bankW));
    if (barPolicy) barPolicy.setAttribute("width", Math.max(10, policyW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
