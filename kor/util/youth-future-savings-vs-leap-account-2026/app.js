import { calculateYouthFutureSavings2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("future-savings-form");
  if (!form) return;

  function update() {
    const monthlyDeposit = Number(document.getElementById("monthlyDeposit").value) || 500000;
    const incomeType = document.getElementById("incomeType").value;
    const bankRatePercent = Number(document.getElementById("bankRatePercent").value) || 5.0;

    const res = calculateYouthFutureSavings2026({
      monthlyDeposit,
      incomeType,
      bankRatePercent
    });

    document.getElementById("res-total-payout").textContent = res.totalPayout.toLocaleString() + "원";
    document.getElementById("res-total-profit").textContent = "+" + res.totalProfit.toLocaleString() + "원 (순수익률 " + res.netReturnPercent + "%)";
    document.getElementById("res-equiv-rate").textContent = "연 " + res.equivalentBankRate + "% 상당 (일반적금 환산)";

    document.getElementById("res-principal").textContent = res.totalPrincipal.toLocaleString() + "원";
    document.getElementById("res-bank-interest").textContent = res.bankInterestPreTax.toLocaleString() + "원 (비과세)";
    document.getElementById("res-match-amount").textContent = res.totalGovernmentMatch.toLocaleString() + "원 (" + res.matchPercent + "% 매칭)";
    document.getElementById("res-monthly-match").textContent = res.monthlyMatch.toLocaleString() + "원 / 월";
    document.getElementById("res-tax-saved").textContent = res.taxSaved.toLocaleString() + "원 절세";

    // SVG Bar Chart 업데이트
    const maxVal = Math.max(res.totalPayout, 1);
    const pW = Math.round((res.totalPrincipal / maxVal) * 260);
    const iW = Math.round((res.bankInterestPreTax / maxVal) * 260);
    const mW = Math.round((res.totalGovernmentMatch / maxVal) * 260);

    const barP = document.getElementById("bar-principal");
    const barI = document.getElementById("bar-interest");
    const barM = document.getElementById("bar-match");
    if (barP) barP.setAttribute("width", Math.max(10, pW));
    if (barI) barI.setAttribute("width", Math.max(5, iW));
    if (barM) barM.setAttribute("width", Math.max(5, mW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
