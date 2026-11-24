import { calculateChildSupport2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("child-support-form");
  if (!form) return;

  function update() {
    const childRank = Number(document.getElementById("childRank").value) || 1;
    const isBirthYear = document.getElementById("isBirthYear").checked;
    const useDaycare = document.getElementById("useDaycare").checked;
    const totalChildrenCount = Number(document.getElementById("totalChildrenCount").value) || 1;

    const res = calculateChildSupport2026({
      childRank,
      isBirthYear,
      useDaycare,
      totalChildrenCount
    });

    document.getElementById("res-first-year-total").textContent = (res.firstYearTotalSupport / 10000).toFixed(0) + "만 원 (" + res.firstYearTotalSupport.toLocaleString() + "원)";
    document.getElementById("res-lifetime-total").textContent = (res.lifetimeTotalSupport / 100000000).toFixed(2) + "억 원 (" + res.lifetimeTotalSupport.toLocaleString() + "원)";

    document.getElementById("res-voucher").textContent = (res.firstMeetingVoucher / 10000).toFixed(0) + "만 원 (국민행복카드)";
    document.getElementById("res-parental").textContent = "월 100만 원 (연 1,200만 원)";
    document.getElementById("res-child-allowance").textContent = "월 10만 원 (연 120만 원)";
    
    document.getElementById("res-tax-credit").textContent = (res.totalYearEndTaxCredit / 10000).toFixed(0) + "만 원 환급";
    document.getElementById("res-tax-desc").textContent = "기본 자녀세액공제 " + (res.baseChildTaxCredit / 10000) + "만 + 출생축하 " + (res.birthYearBonusCredit / 10000) + "만";

    // Chart update
    const maxVal = Math.max(res.firstYearTotalSupport, res.lifetimeTotalSupport, 1);
    const voucherW = Math.min(260, Math.round((res.firstMeetingVoucher / res.firstYearTotalSupport) * 260));
    const parentalW = Math.min(260, Math.round((res.parentalAllowanceYear0 / res.firstYearTotalSupport) * 260));
    const allowW = Math.min(260, Math.round((res.annualChildAllowance / res.firstYearTotalSupport) * 260));
    const taxW = Math.min(260, Math.round((res.totalYearEndTaxCredit / res.firstYearTotalSupport) * 260));

    const bVoucher = document.getElementById("bar-voucher");
    const bParental = document.getElementById("bar-parental");
    const bAllow = document.getElementById("bar-allow");
    const bTax = document.getElementById("bar-tax");

    if (bVoucher) bVoucher.setAttribute("width", Math.max(8, voucherW));
    if (bParental) bParental.setAttribute("width", Math.max(8, parentalW));
    if (bAllow) bAllow.setAttribute("width", Math.max(8, allowW));
    if (bTax) bTax.setAttribute("width", Math.max(8, taxW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
