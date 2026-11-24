import { calculateFinancialTax2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("financial-form");
  if (!form) return;

  function update() {
    const financialIncome = Number(document.getElementById("financialIncome").value) || 0;
    const highDividendPortion = Number(document.getElementById("highDividendPortion").value) || 0;
    const otherTaxableIncome = Number(document.getElementById("otherTaxableIncome").value) || 0;
    const isEmployee = document.getElementById("isEmployee").value === "yes";
    const isaType = document.getElementById("isaType").value;
    const isIsaExpanded = document.getElementById("isIsaExpanded").checked;

    const res = calculateFinancialTax2026({
      financialIncome,
      highDividendPortion,
      otherTaxableIncome,
      isEmployee,
      isaType,
      isIsaExpanded
    });

    // 배당분리과세 추천 여부
    const badgeRec = document.getElementById("res-recommend-badge");
    if (badgeRec) {
      if (res.isSpecialRecommended) {
        badgeRec.textContent = "고배당 분리과세 특례 유리 (절세)";
        badgeRec.className = "badge" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac;";
      } else if (res.isSubjectToComprehensive) {
        badgeRec.textContent = "종합소득 합산과세 대상 (주의)";
        badgeRec.className = "badge" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;";
      } else {
        badgeRec.textContent = "15.4% 원천징수 분리과세 종결 (안전)";
        badgeRec.className = "badge badge-fin";
      }
    }

    document.getElementById("res-total-burden").textContent = res.totalComprehensiveBurden.toLocaleString() + "원";
    document.getElementById("res-special-burden").textContent = res.totalSpecialBurden.toLocaleString() + "원";
    document.getElementById("res-special-saving").textContent = "-" + res.specialSeparationSaving.toLocaleString() + "원 절감";

    document.getElementById("res-income-tax").textContent = res.regularIncomeTax.toLocaleString() + "원";
    document.getElementById("res-local-tax").textContent = res.regularLocalTax.toLocaleString() + "원";
    document.getElementById("res-extra-nhis").textContent = res.annualExtraNhis.toLocaleString() + "원 (월 " + res.monthlyExtraNhis.toLocaleString() + "원)";

    document.getElementById("res-isa-saving").textContent = "+" + res.isaTaxSaving.toLocaleString() + "원 절세";
    document.getElementById("res-isa-limit").textContent = (res.isaTaxFreeLimit / 10000).toLocaleString() + "만 원";

    // SVG Bar Chart 업데이트
    const maxVal = Math.max(res.totalComprehensiveBurden, res.totalSpecialBurden, 1);
    const compW = Math.min(260, Math.round((res.totalComprehensiveBurden / maxVal) * 260));
    const specW = Math.min(260, Math.round((res.totalSpecialBurden / maxVal) * 260));

    const barComp = document.getElementById("bar-comprehensive");
    const barSpec = document.getElementById("bar-special");
    if (barComp) barComp.setAttribute("width", Math.max(10, compW));
    if (barSpec) barSpec.setAttribute("width", Math.max(10, specW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
