import { calculateBrokerageFee2026 } from "./model.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("brokerage-form");
  if (!form) return;

  function update() {
    const transactionType = document.getElementById("transactionType").value;
    const propertyType = document.getElementById("propertyType").value;
    const depositOrPrice = Number(document.getElementById("depositOrPrice").value) || 0;
    const monthlyRent = Number(document.getElementById("monthlyRent").value) || 0;
    const vatType = document.getElementById("vatType").value;

    const rentGroup = document.getElementById("rent-group");
    if (rentGroup) {
      rentGroup.style.display = transactionType === "rent" ? "block" : "none";
    }

    const res = calculateBrokerageFee2026({
      transactionType,
      propertyType,
      depositOrPrice,
      monthlyRent,
      vatType
    });

    document.getElementById("res-total-fee").textContent = res.totalPayableFee.toLocaleString() + "원 (VAT 포함)";
    document.getElementById("res-raw-fee").textContent = res.rawFee.toLocaleString() + "원 (상한요율 " + res.maxRatePercent + "%)";
    document.getElementById("res-vat-amount").textContent = "+" + res.vatAmount.toLocaleString() + "원 (" + (res.vatRate * 100) + "%)";
    document.getElementById("res-transaction-amount").textContent = res.transactionAmount.toLocaleString() + "원" + (res.is70MultiplierApplied ? " (5천만 미만 70배 공식 적용)" : "");

    const limitNotice = document.getElementById("res-limit-notice");
    if (limitNotice) {
      if (res.isLimitApplied) {
        limitNotice.style.display = "block";
        limitNotice.textContent = "💡 법정 상한 한도액(" + res.limitAmount.toLocaleString() + "원)이 적용되어 초과 청구가 금지됩니다.";
      } else {
        limitNotice.style.display = "none";
      }
    }

    // SVG Bar Chart 업데이트 (본수수료 vs VAT)
    const maxVal = Math.max(res.totalPayableFee, 1);
    const feeW = Math.round((res.rawFee / maxVal) * 260);
    const vatW = Math.round((res.vatAmount / maxVal) * 260);

    const barFee = document.getElementById("bar-fee");
    const barVat = document.getElementById("bar-vat");
    if (barFee) barFee.setAttribute("width", Math.max(10, feeW));
    if (barVat) barVat.setAttribute("width", Math.max(2, vatW));
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
});
