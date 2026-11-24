import { calculateHousingPension2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("pension-form");
  if (!form) return;

  function update() {
    const age = Number(document.getElementById("age").value) || 65;
    const housePrice = Number(document.getElementById("housePrice").value) || 500000000;
    const payoutType = document.getElementById("payoutType").value;
    const targetAge = Number(document.getElementById("targetAge").value) || 85;

    const res = calculateHousingPension2026({
      age,
      housePrice,
      payoutType,
      targetAge
    });

    document.getElementById("res-monthly-payout").textContent = (res.monthlyPayout / 10000).toFixed(1) + "만 원 (" + res.monthlyPayout.toLocaleString() + "원)";
    document.getElementById("res-rate-info").textContent = "1억 원당 월 " + (res.ratePer100M / 10000).toFixed(2) + "만 원 (만 " + res.age + "세 기준)";
    
    document.getElementById("res-total-target").textContent = (res.totalPayoutAtTarget / 100000000).toFixed(2) + "억 원 (" + res.totalPayoutAtTarget.toLocaleString() + "원)";
    document.getElementById("res-target-desc").textContent = "만 " + res.targetAge + "세까지 " + (res.targetAge - res.age) + "년간 누적 수령액";

    document.getElementById("res-cum-85").textContent = (res.cumulativeAt85 / 100000000).toFixed(2) + "억 원";
    document.getElementById("res-cum-90").textContent = (res.cumulativeAt90 / 100000000).toFixed(2) + "억 원";
    document.getElementById("res-cum-95").textContent = (res.cumulativeAt95 / 100000000).toFixed(2) + "억 원";

    document.getElementById("res-breakeven").textContent = "만 " + res.breakevenAge + "세 (" + Math.round(res.breakevenMonths / 12) + "년 경과)";

    // 에러 및 안내 메시지
    const errBox = document.getElementById("res-error-box");
    if (errBox) {
      if (!res.isEligibleAge) {
        errBox.style.display = "block";
        errBox.textContent = "⚠️ 만 55세 미만은 주택연금 신청 자격이 되지 않습니다 (부부 중 연소자 기준).";
      } else if (res.isPriceOverLimit) {
        errBox.style.display = "block";
        errBox.textContent = "ℹ️ 주택가격이 12억 원을 초과할 경우, 연금 산정은 법정 상한액인 12억 원까지만 반영됩니다.";
      } else {
        errBox.style.display = "none";
      }
    }

    // Chart update (누적 수령액 vs 집값)
    const maxVal = Math.max(res.effectivePrice, res.cumulativeAt95, 1);
    const houseW = Math.min(260, Math.round((res.effectivePrice / maxVal) * 260));
    const cum85W = Math.min(260, Math.round((res.cumulativeAt85 / maxVal) * 260));
    const cum95W = Math.min(260, Math.round((res.cumulativeAt95 / maxVal) * 260));

    const barHouse = document.getElementById("bar-house");
    const barCum85 = document.getElementById("bar-cum85");
    const barCum95 = document.getElementById("bar-cum95");

    if (barHouse) barHouse.setAttribute("width", Math.max(10, houseW));
    if (barCum85) barCum85.setAttribute("width", Math.max(10, cum85W));
    if (barCum95) barCum95.setAttribute("width", Math.max(10, cum95W));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
