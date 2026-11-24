import { calculateMultiHouseTax2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("multihouse-form");
  if (!form) return;

  function update() {
    const sellingPrice = Number(document.getElementById("sellingPrice").value) || 1200000000;
    const acquisitionPrice = Number(document.getElementById("acquisitionPrice").value) || 700000000;
    const necessaryExpenses = Number(document.getElementById("necessaryExpenses").value) || 20000000;
    const holdingYears = Number(document.getElementById("holdingYears").value) || 5;
    const houseCount = Number(document.getElementById("houseCount").value) || 2;
    const isAdjustedArea = document.getElementById("isAdjustedArea").checked;

    const res = calculateMultiHouseTax2026({
      sellingPrice,
      acquisitionPrice,
      necessaryExpenses,
      holdingYears,
      houseCount,
      isAdjustedArea
    });

    document.getElementById("res-gain").textContent = (res.capitalGain / 100000000).toFixed(2) + "억 원 (" + res.capitalGain.toLocaleString() + "원)";
    
    document.getElementById("res-tax-a").textContent = (res.scenarioA.totalTax / 100000000).toFixed(2) + "억 원 (" + res.scenarioA.totalTax.toLocaleString() + "원)";
    document.getElementById("res-tax-b").textContent = (res.scenarioB.totalTax / 100000000).toFixed(2) + "억 원 (" + res.scenarioB.totalTax.toLocaleString() + "원)";
    document.getElementById("res-tax-c").textContent = (res.scenarioC.totalTax / 100000000).toFixed(2) + "억 원 (" + res.scenarioC.totalTax.toLocaleString() + "원)";
    document.getElementById("res-tax-d").textContent = (res.scenarioD.totalTax / 100000000).toFixed(2) + "억 원 (" + res.scenarioD.totalTax.toLocaleString() + "원)";

    document.getElementById("res-refund").textContent = (res.refundDiff / 100000000).toFixed(2) + "억 원 (" + res.refundDiff.toLocaleString() + "원)";
    document.getElementById("res-diff-desc").textContent = "법정 중과 대비 2027년 세제개편안 완화 시 소급 환급 절세액";

    // Chart update
    const maxVal = Math.max(res.scenarioA.totalTax, res.scenarioB.totalTax, res.scenarioD.totalTax, 1);
    const barAW = Math.min(260, Math.round((res.scenarioA.totalTax / maxVal) * 260));
    const barBW = Math.min(260, Math.round((res.scenarioB.totalTax / maxVal) * 260));
    const barCW = Math.min(260, Math.round((res.scenarioC.totalTax / maxVal) * 260));
    const barDW = Math.min(260, Math.round((res.scenarioD.totalTax / maxVal) * 260));

    const bA = document.getElementById("bar-a");
    const bB = document.getElementById("bar-b");
    const bC = document.getElementById("bar-c");
    const bD = document.getElementById("bar-d");

    if (bA) bA.setAttribute("width", Math.max(8, barAW));
    if (bB) bB.setAttribute("width", Math.max(8, barBW));
    if (bC) bC.setAttribute("width", Math.max(8, barCW));
    if (bD) bD.setAttribute("width", Math.max(8, barDW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
