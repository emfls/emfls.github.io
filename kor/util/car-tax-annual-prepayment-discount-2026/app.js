import { calculateCarTax2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("cartax-form");
  if (!form) return;

  function update() {
    const vehicleType = document.getElementById("vehicleType").value;
    const engineCc = Number(document.getElementById("engineCc").value) || 1999;
    const firstRegYear = Number(document.getElementById("firstRegYear").value) || 2026;
    const prepayMonth = document.getElementById("prepayMonth").value;

    const res = calculateCarTax2026({
      vehicleType,
      engineCc,
      firstRegYear,
      prepayMonth
    });

    // 배기량 입력 필드 활성/비활성화
    const ccGroup = document.getElementById("cc-group");
    if (ccGroup) {
      ccGroup.style.display = vehicleType === "electric" ? "none" : "block";
    }

    // 결과 업데이트
    document.getElementById("res-final-payable").textContent = res.finalPayableTax.toLocaleString() + "원";
    document.getElementById("res-prepay-discount").textContent = "-" + res.prepayDiscountAmount.toLocaleString() + "원 (" + res.effectiveDiscountPercent + "% 할인)";
    document.getElementById("res-annual-regular").textContent = res.annualRegularTax.toLocaleString() + "원";

    document.getElementById("res-car-age").textContent = res.carAge + "년차 (" + res.ageDiscountPercent + "% 감면)";
    document.getElementById("res-base-tax").textContent = res.discountedBaseTax.toLocaleString() + "원";
    document.getElementById("res-edu-tax").textContent = res.educationTax.toLocaleString() + "원";

    document.getElementById("res-june-tax").textContent = res.juneRegularTax.toLocaleString() + "원";
    document.getElementById("res-dec-tax").textContent = res.decemberRegularTax.toLocaleString() + "원";

    document.getElementById("res-jan-discount").textContent = res.janDiscountAmount.toLocaleString() + "원";
    document.getElementById("res-yield").textContent = "연 " + res.equivalentAnnualYield + "% 확정수익 효과";
    document.getElementById("res-10yr-total").textContent = res.tenYearTotalTax.toLocaleString() + "원";

    // SVG Bar Chart 업데이트 (정기분 vs 1월 연납)
    const maxVal = Math.max(res.annualRegularTax, 1);
    const regularBarW = Math.min(260, Math.round((res.annualRegularTax / maxVal) * 260));
    const prepayBarW = Math.min(260, Math.round((res.finalPayableTax / maxVal) * 260));

    const barReg = document.getElementById("bar-regular");
    const barPre = document.getElementById("bar-prepay");
    if (barReg) barReg.setAttribute("width", Math.max(10, regularBarW));
    if (barPre) barPre.setAttribute("width", Math.max(10, prepayBarW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
