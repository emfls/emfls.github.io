import { calculateTermVsWholeLife } from "./model.mjs";

function fmt(n) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function runCalc() {
  const startingAge = parseInt(document.getElementById("startingAge").value, 10) || 35;
  const coverageAmount = parseFloat(document.getElementById("coverageAmount").value) || 1000000;
  const termMonthlyPremium = parseFloat(document.getElementById("termPremium").value) || 65;
  const wholeLifeMonthlyPremium = parseFloat(document.getElementById("wholeLifePremium").value) || 850;
  const investmentReturnPct = parseFloat(document.getElementById("invReturn").value) || 6.5;
  const dividendScalePct = parseFloat(document.getElementById("divScale").value) || 6.0;

  try {
    const res = calculateTermVsWholeLife({
      startingAge,
      coverageAmount,
      termMonthlyPremium,
      wholeLifeMonthlyPremium,
      investmentReturnPct,
      dividendScalePct
    });

    setEl("outMonthlySavings", fmt(res.monthlySavings));
    setEl("outAnnualSavings", fmt(res.annualSavings));

    // Year 20 Comparison (Age 55)
    setEl("outY20BtidLiquid", fmt(res.y20.btidPortfolio));
    setEl("outY20WholeCsv", fmt(res.y20.wholeLifeCsv));
    setEl("outY20BtidEstate", fmt(res.y20.btidTotalEstate));
    setEl("outY20WholeEstate", fmt(res.y20.wholeLifeDeathBenefit));

    // Year 35 Comparison (Age 70 - Term Expired!)
    setEl("outY35BtidEstate", fmt(res.y35.btidTotalEstate));
    setEl("outY35WholeEstate", fmt(res.y35.wholeLifeDeathBenefit));

    const verdictEl = document.getElementById("outVerdict");
    if (verdictEl) {
      verdictEl.textContent = `At Year 20 (Age 55), BTID yields ${fmt(res.y20.btidPortfolio)} in liquid TFSA wealth vs ${fmt(res.y20.wholeLifeCsv)} in Whole Life cash surrender value. At Year 35 (Age 70), after term life expires, Whole Life provides ${fmt(res.y35.wholeLifeDeathBenefit)} in permanent tax-free estate transfer.`;
    }
  } catch (err) {
    console.error("Calculation error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input");
  inputs.forEach(el => el.addEventListener("input", runCalc));
  runCalc();
});
