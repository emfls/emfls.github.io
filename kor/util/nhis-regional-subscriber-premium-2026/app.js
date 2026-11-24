import { calculateRegionalNhis2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("regional-nhis-form");
  if (!form) return;

  function update() {
    const annualBusinessIncome = Number(document.getElementById("annualBusinessIncome").value) || 0;
    const annualSalaryPensionIncome = Number(document.getElementById("annualSalaryPensionIncome").value) || 0;
    const annualFinancialIncome = Number(document.getElementById("annualFinancialIncome").value) || 0;
    const propertyTaxBase = Number(document.getElementById("propertyTaxBase").value) || 0;
    const jeonseDeposit = Number(document.getElementById("jeonseDeposit").value) || 0;
    const previousWorkplacePremium = Number(document.getElementById("previousWorkplacePremium").value) || 0;

    const res = calculateRegionalNhis2026({
      annualBusinessIncome,
      annualSalaryPensionIncome,
      annualFinancialIncome,
      propertyTaxBase,
      jeonseDeposit,
      previousWorkplacePremium
    });

    document.getElementById("res-monthly-total").textContent = res.monthlyTotalPremium.toLocaleString() + "원 / 월";
    document.getElementById("res-annual-total").textContent = res.annualTotalPremium.toLocaleString() + "원 / 연";

    document.getElementById("res-income-nhis").textContent = res.monthlyIncomeNhis.toLocaleString() + "원";
    document.getElementById("res-property-nhis").textContent = res.monthlyPropertyNhis.toLocaleString() + "원 (" + res.propertyPoints + "점)";
    document.getElementById("res-car-nhis").textContent = "0원 (폐지)";
    document.getElementById("res-ltc").textContent = res.monthlyLtc.toLocaleString() + "원 (13.14%)";

    // 임의계속가입 결과
    const volBox = document.getElementById("res-voluntary-box");
    if (volBox) {
      if (res.isVoluntaryAdvantageous) {
        volBox.style.display = "block";
        document.getElementById("res-vol-saving").textContent = "월 " + res.monthlyVoluntarySaving.toLocaleString() + "원 (36개월간 총 " + res.total36MonthSaving.toLocaleString() + "원 절감!)";
      } else {
        volBox.style.display = "none";
      }
    }

    // SVG Bar Chart 업데이트
    const maxVal = Math.max(res.monthlyTotalPremium, 1);
    const incW = Math.min(260, Math.round((res.monthlyIncomeNhis / maxVal) * 260));
    const propW = Math.min(260, Math.round((res.monthlyPropertyNhis / maxVal) * 260));
    const ltcW = Math.min(260, Math.round((res.monthlyLtc / maxVal) * 260));

    const barInc = document.getElementById("bar-income");
    const barProp = document.getElementById("bar-property");
    const barLtc = document.getElementById("bar-ltc");
    if (barInc) barInc.setAttribute("width", Math.max(5, incW));
    if (barProp) barProp.setAttribute("width", Math.max(5, propW));
    if (barLtc) barLtc.setAttribute("width", Math.max(5, ltcW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
