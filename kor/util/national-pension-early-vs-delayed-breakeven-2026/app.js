import { calculateNationalPensionBreakeven2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("pension-form");
  if (!form) return;

  function update() {
    const normalMonthlyPension = Number(document.getElementById("normalMonthlyPension").value) || 1200000;
    const birthYear = Number(document.getElementById("birthYear").value) || 1970;
    const earlyYears = Number(document.getElementById("earlyYears").value) || 5;
    const delayedYears = Number(document.getElementById("delayedYears").value) || 5;

    const res = calculateNationalPensionBreakeven2026({
      normalMonthlyPension,
      birthYear,
      earlyYears,
      delayedYears
    });

    document.getElementById("res-early-breakeven").textContent = "만 " + res.breakevenAgeEarlyVsNormal + "세";
    document.getElementById("res-delayed-breakeven").textContent = "만 " + res.breakevenAgeNormalVsDelayed + "세";

    document.getElementById("res-early-monthly").textContent = res.earlyMonthlyPension.toLocaleString() + "원 / 월 (" + res.earlyRatePercent + "%)";
    document.getElementById("res-normal-monthly").textContent = res.normalMonthlyPension.toLocaleString() + "원 / 월 (100%)";
    document.getElementById("res-delayed-monthly").textContent = res.delayedMonthlyPension.toLocaleString() + "원 / 월 (" + res.delayedRatePercent + "%)";

    document.getElementById("res-normal-age").textContent = "만 " + res.normalAge + "세 개시";
    document.getElementById("res-early-age").textContent = "만 " + res.earlyStartAge + "세 개시 (" + res.earlyYears + "년 조기)";
    document.getElementById("res-delayed-age").textContent = "만 " + res.delayedStartAge + "세 개시 (" + res.delayedYears + "년 연기)";

    document.getElementById("res-at80-normal").textContent = res.at80CumNormal.toLocaleString() + "원";
    document.getElementById("res-at80-early").textContent = res.at80CumEarly.toLocaleString() + "원";
    document.getElementById("res-at85-delayed").textContent = res.at85CumDelayed.toLocaleString() + "원";

    // 건보 피부양자 탈락 경보
    const nhisNotice = document.getElementById("res-nhis-warning");
    if (nhisNotice) {
      if (res.isDelayedTriggerNhisDisqualification) {
        nhisNotice.style.display = "block";
        nhisNotice.textContent = "⚠️ 연기연금 신청 시 연간 연금 수령액이 2,000만 원(연 " + (res.delayedAnnualPension / 10000).toLocaleString() + "만 원)을 초과하여 건강보험 피부양자 자격이 박탈되고 매월 지역건보료가 부과될 수 있습니다!";
      } else if (res.isNormalTriggerNhisDisqualification) {
        nhisNotice.style.display = "block";
        nhisNotice.textContent = "⚠️ 정상수령 시에도 연간 연금 수령액이 2,000만 원(연 " + (res.normalAnnualPension / 10000).toLocaleString() + "만 원)을 초과하여 건강보험 피부양자 탈락 대상입니다.";
      } else {
        nhisNotice.style.display = "none";
      }
    }

    // SVG Bar Chart 업데이트 (85세 시점 누적액 비교)
    const maxVal = Math.max(res.at85CumDelayed, res.at85CumNormal, 1);
    const eW = Math.round((res.at80CumEarly / maxVal) * 260);
    const nW = Math.round((res.at85CumNormal / maxVal) * 260);
    const dW = Math.round((res.at85CumDelayed / maxVal) * 260);

    const barEarly = document.getElementById("bar-early");
    const barNormal = document.getElementById("bar-normal");
    const barDelayed = document.getElementById("bar-delayed");
    if (barEarly) barEarly.setAttribute("width", Math.max(10, eW));
    if (barNormal) barNormal.setAttribute("width", Math.max(10, nW));
    if (barDelayed) barDelayed.setAttribute("width", Math.max(10, dW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
