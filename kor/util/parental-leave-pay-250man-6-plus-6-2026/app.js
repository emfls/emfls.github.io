import { calculateParentalLeavePay2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("parental-form");
  if (!form) return;

  function update() {
    const params = {
      wage: Number(document.getElementById("wage").value) || 0,
      leaveMonths: Number(document.getElementById("leaveMonths").value) || 12,
      is6Plus6Eligible: document.getElementById("is6Plus6Eligible").checked,
      spouseWage: Number(document.getElementById("spouseWage").value) || 0
    };

    const res = calculateParentalLeavePay2026(params);

    const is6 = params.is6Plus6Eligible;
    const totalPay = is6 ? res.self6Plus6Total : res.normalTotalPay;

    document.getElementById("res-total-pay").textContent = Math.round(totalPay).toLocaleString() + "원";
    document.getElementById("res-avg-monthly").textContent = Math.round(totalPay / params.leaveMonths).toLocaleString() + "원 / 월";

    const badge = document.getElementById("res-badge");
    const coupleBox = document.getElementById("res-couple-box");
    if (is6) {
      badge.textContent = "6+6 부모육아휴직제 100% 적용";
      badge.className = "badge badge-66";
      coupleBox.style.display = "block";
      document.getElementById("res-couple-total").textContent = Math.round(res.coupleCombinedTotal).toLocaleString() + "원";
      document.getElementById("res-first-6m-combined").textContent = Math.round(res.first6MonthsCombined).toLocaleString() + "원";
      document.getElementById("res-additional-benefit").textContent = "+" + Math.round(res.additionalBenefitOverNormal).toLocaleString() + "원";
    } else {
      badge.textContent = "2026 일반 육아휴직급여 (월 250만 원 상한)";
      badge.className = "badge badge-normal";
      coupleBox.style.display = "none";
    }

    // Schedule Table
    const tbody = document.getElementById("schedule-tbody");
    if (tbody) {
      tbody.innerHTML = "";
      const sched = is6 ? res.self6Plus6Schedule : res.normalSchedule;
      sched.forEach(s => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${s.month}개월차</strong></td>
          <td>${s.month <= 6 && is6 ? "6+6 특례 (100%)" : (s.month <= 6 ? "통상임금 100%" : "통상임금 80%")}</td>
          <td>${Math.round(s.cap).toLocaleString()}원</td>
          <td><strong style="color:var(--primary);">${Math.round(s.pay).toLocaleString()}원</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
