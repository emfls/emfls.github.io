import { calculateCreditLoanDsrTrap2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("minus-dsr-form");
  if (!form) return;

  function update() {
    const annualIncome = Number(document.getElementById("annualIncome").value) || 0;
    const minusAccountLimit = Number(document.getElementById("minusAccountLimit").value) || 0;
    const minusAccountRate = Number(document.getElementById("minusAccountRate").value) || 5.0;
    const actualUsedAmount = Number(document.getElementById("actualUsedAmount").value) || 0;
    const existingAnnualDebtService = Number(document.getElementById("existingAnnualDebtService").value) || 0;
    const financialSector = document.getElementById("financialSector").value || "bank";
    const mortgageInterestRate = Number(document.getElementById("mortgageInterestRate").value) || 4.0;
    const mortgageTermYears = Number(document.getElementById("mortgageTermYears").value) || 30;

    const res = calculateCreditLoanDsrTrap2026({
      annualIncome,
      minusAccountLimit,
      minusAccountRate,
      actualUsedAmount,
      existingAnnualDebtService,
      financialSector,
      mortgageInterestRate,
      mortgageTermYears
    });

    document.getElementById("res-minus-dsr-burden").textContent = res.minusAnnualDsrBurden.toLocaleString() + "원/년";
    document.getElementById("res-minus-dsr-principal").textContent = res.minusDsrPrincipal.toLocaleString() + "원 (5년 의제 20%)";
    document.getElementById("res-actual-annual-interest").textContent = res.actualAnnualInterest.toLocaleString() + "원/년 (월 " + res.actualMonthlyInterest.toLocaleString() + "원)";

    document.getElementById("res-current-dsr").textContent = res.currentDsrPercent + "% (한도 " + res.dsrCapPercent + "%)";
    document.getElementById("res-remaining-capacity").textContent = res.remainingDebtCapacity.toLocaleString() + "원/년";

    document.getElementById("res-current-mortgage").textContent = res.mortgageBorrowingCapacity.toLocaleString() + "원";
    document.getElementById("res-restored-mortgage").textContent = res.restoredMortgageCapacity.toLocaleString() + "원";
    document.getElementById("res-wiped-mortgage").textContent = res.wipedOutMortgageAmount.toLocaleString() + "원";

    const badge = document.getElementById("res-wiped-badge");
    if (badge) {
      if (res.wipedOutMortgageAmount > 0) {
        badge.textContent = `🚨 마통 때문에 주담대 ${Math.floor(res.wipedOutMortgageAmount / 10000000)}천만 원 증발 (약 ${res.wipedOutMultiplier}배 손실)`;
        badge.className = "badge badge-danger";
      } else {
        badge.textContent = `주담대 영향 없음`;
        badge.className = "badge badge-success";
      }
    }

    const alertBox = document.getElementById("res-status-alert");
    if (alertBox) {
      alertBox.textContent = res.statusMessage;
      if (res.dsrStatus === "OVER_CAP") {
        alertBox.className = "alert-box alert-danger";
      } else if (res.dsrStatus === "WARNING") {
        alertBox.className = "alert-box alert-warning";
      } else {
        alertBox.className = "alert-box alert-info";
      }
    }

    // SVG Chart Update
    const maxVal = Math.max(res.restoredMortgageCapacity, 1);
    const restoredW = 260;
    const currentW = Math.max(10, Math.round((res.mortgageBorrowingCapacity / maxVal) * 260));

    const barRestored = document.getElementById("chart-bar-restored");
    const barCurrent = document.getElementById("chart-bar-current");
    const txtRestored = document.getElementById("chart-txt-restored");
    const txtCurrent = document.getElementById("chart-txt-current");

    if (barRestored) barRestored.setAttribute("width", restoredW.toString());
    if (barCurrent) barCurrent.setAttribute("width", currentW.toString());
    if (txtRestored) txtRestored.textContent = res.restoredMortgageCapacity.toLocaleString() + "원 (마통 해지 시)";
    if (txtCurrent) txtCurrent.textContent = res.mortgageBorrowingCapacity.toLocaleString() + "원 (현재 가능 한도)";
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
