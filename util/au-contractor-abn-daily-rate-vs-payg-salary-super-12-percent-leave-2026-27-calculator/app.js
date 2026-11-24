import { calculateContractorVsPayg } from "./model.mjs";

function fmt(n) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

function fmtDec(n) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function runCalc() {
  const baseSalary = parseFloat(document.getElementById("baseSalary").value) || 130000;
  const benchDays = parseInt(document.getElementById("benchDays").value, 10) || 10;
  const annualOverheads = parseFloat(document.getElementById("annualOverheads").value) || 5000;
  const riskPremiumPct = parseFloat(document.getElementById("riskPremium").value) || 15.0;
  const offeredDailyRate = parseFloat(document.getElementById("offeredDailyRate").value) || 0;

  try {
    const res = calculateContractorVsPayg({
      baseSalary,
      benchDays,
      annualOverheads,
      riskPremiumPct,
      offeredDailyRate
    });

    setEl("outBreakevenDailyEx", fmt(res.breakevenDailyRateExGst));
    setEl("outBreakevenDailyInc", fmt(res.breakevenDailyRateIncGst));
    setEl("outRecDailyEx", fmt(res.recommendedDailyRateExGst));
    setEl("outRecDailyInc", fmt(res.recommendedDailyRateIncGst));

    setEl("outBreakevenHourly", fmtDec(res.breakevenHourlyRate));
    setEl("outRecHourly", fmtDec(res.recommendedHourlyRate));

    setEl("outBillableDays", `${res.billableDays} days`);
    setEl("outPaygSuper", fmt(res.paygSuper));
    setEl("outTotalPaygPackage", fmt(res.totalPaygPackage));
    setEl("outPaygNetTakeHome", fmt(res.paygNetTakeHome));

    const offerCard = document.getElementById("offerResults");
    if (res.offeredDailyRate > 0 && offerCard) {
      offerCard.style.display = "block";
      setEl("outOfferedGrossRev", fmt(res.offeredRevenueExGst));
      setEl("outOfferedNet", fmt(res.offeredContractorNet));
      const advEl = document.getElementById("outNetAdvantage");
      if (advEl) {
        advEl.textContent = (res.netTakeHomeAdvantage >= 0 ? "+" : "") + fmt(res.netTakeHomeAdvantage);
        advEl.style.color = res.netTakeHomeAdvantage >= 0 ? "#16a34a" : "#dc2626";
      }
    } else if (offerCard) {
      offerCard.style.display = "none";
    }

    const gstNotice = document.getElementById("gstNotice");
    if (gstNotice) {
      gstNotice.style.display = res.isGstMandatory ? "block" : "none";
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
