import { computeRetirementPlan } from "./model.mjs";

function fmt(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function runCalc() {
  const pot = parseFloat(document.getElementById("pensionPot").value) || 300000;
  const startAge = parseInt(document.getElementById("startAge").value, 10) || 65;
  const annuityType = document.getElementById("annuityType").value;
  let annuityRatePct = parseFloat(document.getElementById("annuityRate").value) || 7.1;
  let escalationPct = 0;

  if (annuityType === "escalating_3pct") {
    escalationPct = 3.0;
    annuityRatePct = 5.0; // Market benchmark for 3% escalating at 65
    document.getElementById("annuityRate").value = "5.0";
  } else if (annuityType === "level") {
    escalationPct = 0;
    if (parseFloat(document.getElementById("annuityRate").value) === 5.0) {
      document.getElementById("annuityRate").value = "7.1";
      annuityRatePct = 7.1;
    }
  }

  const investmentReturnPct = parseFloat(document.getElementById("invReturn").value) || 5.5;
  const fundFeePct = parseFloat(document.getElementById("fundFee").value) || 0.45;

  try {
    const res = computeRetirementPlan({
      pot,
      startAge,
      annuityRatePct,
      escalationPct,
      investmentReturnPct,
      fundFeePct
    });

    setEl("outAnnualAnnuity", fmt(res.year1Annuity));
    setEl("outMonthlyAnnuity", fmt(res.year1Annuity / 12));
    setEl("outDepletionAge", typeof res.depletionAge === "number" ? "Age " + res.depletionAge : res.depletionAge);
    setEl("outBreakevenAge", typeof res.breakevenAge === "number" ? "Age " + res.breakevenAge : res.breakevenAge);

    setEl("outEstate75", fmt(res.estate75));
    setEl("outEstate85", fmt(res.estate85));
    setEl("outEstate95", fmt(res.estate95));

    // Summary callout
    const verdictEl = document.getElementById("outVerdict");
    if (verdictEl) {
      if (typeof res.depletionAge === "number") {
        verdictEl.textContent = `At a ${annuityRatePct}% withdrawal rate, your flexi-drawdown pot will be completely depleted at Age ${res.depletionAge}. The lifetime annuity guarantees income for life with zero depletion risk!`;
      } else {
        verdictEl.textContent = `At a ${annuityRatePct}% withdrawal rate, strong investment growth maintains the drawdown pot past age 100, leaving substantial inheritance.`;
      }
    }
  } catch (err) {
    console.error("Calculation error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input, select");
  inputs.forEach(el => el.addEventListener("input", runCalc));
  document.getElementById("annuityType").addEventListener("change", runCalc);
  runCalc();
});
