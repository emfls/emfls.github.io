import { calculateCryptoTaxSimulator2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("crypto-calc-form");
  if (!form) return;

  function update() {
    const annualGains = Number(document.getElementById("annualGains").value) || 0;
    const annualLosses = Number(document.getElementById("annualLosses").value) || 0;
    const transactionFees = Number(document.getElementById("transactionFees").value) || 0;
    const priorLossCarryforward = Number(document.getElementById("priorLossCarryforward").value) || 0;
    const apply2029DelayReform = document.getElementById("apply2029DelayReform").checked;
    const stagedSellingYears = Number(document.getElementById("stagedSellingYears").value) || 1;

    const res = calculateCryptoTaxSimulator2026({
      annualGains,
      annualLosses,
      transactionFees,
      priorLossCarryforward,
      apply2029DelayReform,
      stagedSellingYears
    });

    document.getElementById("res-net-profit").textContent = res.netTradingProfit.toLocaleString() + "원";
    document.getElementById("res-loss-offset").textContent = res.effectivePriorLoss.toLocaleString() + "원 공제";
    document.getElementById("res-tax-base").textContent = res.taxBase.toLocaleString() + "원";
    
    document.getElementById("res-projected-tax").textContent = res.projectedTax.toLocaleString() + "원 (22%)";
    document.getElementById("res-effective-rate").textContent = res.effectiveTaxRate + "%";
    document.getElementById("res-net-take-home").textContent = res.netTakeHome.toLocaleString() + "원";

    // Staged selling
    document.getElementById("res-staged-tax").textContent = res.stagedTotalTax.toLocaleString() + "원 (" + res.stagedSellingYears + "년 분할)";
    document.getElementById("res-staged-saving").textContent = res.stagedSaving.toLocaleString() + "원 절세";

    // Comparison
    document.getElementById("res-comp-overseas").textContent = res.overseasStockTax.toLocaleString() + "원";
    document.getElementById("res-comp-domestic").textContent = res.domesticStockTax.toLocaleString() + "원";

    const badge = document.getElementById("res-status-badge");
    if (badge) {
      if (res.stagedSaving > 0) {
        badge.textContent = `연말 분할 매도 시 ${res.stagedSaving.toLocaleString()}원 절세 가능!`;
        badge.className = "badge badge-success";
      } else {
        badge.textContent = `2026년 현재 비과세 (과세 시행 시뮬레이션)`;
        badge.className = "badge badge-info";
      }
    }

    // SVG Chart
    const maxVal = Math.max(res.netTradingProfit, 1);
    const profitW = 260;
    const lumpTaxW = Math.max(4, Math.round((res.projectedTax / maxVal) * 260));
    const stagedTaxW = Math.max(2, Math.round((res.stagedTotalTax / maxVal) * 260));

    const barProfit = document.getElementById("chart-bar-profit");
    const barLumpTax = document.getElementById("chart-bar-lumptax");
    const barStagedTax = document.getElementById("chart-bar-stagedtax");

    if (barProfit) barProfit.setAttribute("width", profitW.toString());
    if (barLumpTax) barLumpTax.setAttribute("width", lumpTaxW.toString());
    if (barStagedTax) barStagedTax.setAttribute("width", stagedTaxW.toString());

    const txtProfit = document.getElementById("chart-txt-profit");
    const txtLumpTax = document.getElementById("chart-txt-lumptax");
    const txtStagedTax = document.getElementById("chart-txt-stagedtax");

    if (txtProfit) txtProfit.textContent = res.netTradingProfit.toLocaleString() + "원 (순수익)";
    if (txtLumpTax) txtLumpTax.textContent = res.projectedTax.toLocaleString() + "원 (일괄 매도 세액)";
    if (txtStagedTax) txtStagedTax.textContent = res.stagedTotalTax.toLocaleString() + "원 (" + res.stagedSellingYears + "년 분할 절세액)";
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
