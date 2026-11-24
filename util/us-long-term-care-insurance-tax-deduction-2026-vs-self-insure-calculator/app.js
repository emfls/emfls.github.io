import { computeLTCIPlan } from "./model.mjs";

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function runCalc() {
  const age = parseInt(document.getElementById("primaryAge").value, 10) || 58;
  const taxpayerType = document.getElementById("taxpayerType").value;
  const annualPremium = parseFloat(document.getElementById("annualPremium").value) || 3200;
  const agi = parseFloat(document.getElementById("agi").value) || 120000;
  const marginalTaxRate = parseFloat(document.getElementById("marginalTaxRate").value) || 24;
  const spouseAge = parseInt(document.getElementById("spouseAge").value, 10) || 0;
  const spousePremium = parseFloat(document.getElementById("spousePremium").value) || 0;
  const careAge = parseInt(document.getElementById("careAge").value, 10) || 83;
  const monthlyBenefit = parseFloat(document.getElementById("monthlyBenefit").value) || 6000;
  const inflationRiderPct = parseFloat(document.getElementById("inflationRider").value) || 3.0;
  const annualCareCostToday = parseFloat(document.getElementById("careCostToday").value) || 115000;

  try {
    const res = computeLTCIPlan({
      age,
      taxpayerType,
      annualPremium,
      agi,
      marginalTaxRate,
      spouseAge,
      spousePremium,
      careAge,
      monthlyBenefit,
      inflationRiderPct,
      annualCareCostToday
    });

    setEl("outIrsCapPrimary", fmt(res.tax.irsCapPrimary));
    setEl("outDeductible", fmt(res.tax.deductibleAmount));
    setEl("outTaxSavings", fmt(res.tax.taxSavings));
    setEl("outNetPremium", fmt(res.tax.netEffectivePremium));

    setEl("outSinkingFund", fmt(res.sim.selfInsureFundAtCare));
    setEl("outCareCostYear1", fmt(res.sim.careCostYear1));
    setEl("outBenefitYear1", fmt(res.sim.annualPolicyBenefitYear1));

    // 3-Year Event
    setEl("out3YrCost", fmt(res.sim.event3Yr.totalCareCost));
    setEl("out3YrBenefit", fmt(res.sim.event3Yr.ltciBenefitPaid));
    setEl("out3YrSelfEstate", fmt(res.sim.event3Yr.selfInsureEstateNet));
    setEl("out3YrAdvantage", fmt(res.sim.event3Yr.ltciPreservationAdvantage));

    // 5-Year Event
    setEl("out5YrCost", fmt(res.sim.event5Yr.totalCareCost));
    setEl("out5YrBenefit", fmt(res.sim.event5Yr.ltciBenefitPaid));
    setEl("out5YrSelfEstate", fmt(res.sim.event5Yr.selfInsureEstateNet));
    setEl("out5YrAdvantage", fmt(res.sim.event5Yr.ltciPreservationAdvantage));

  } catch (err) {
    console.error("Calculation error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input, select");
  inputs.forEach(el => el.addEventListener("input", runCalc));
  runCalc();
});
