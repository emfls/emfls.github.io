import { calcUkBridgingLoan } from './model.mjs';

function fmtGBP(val) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const propertyValue = parseFloat(document.getElementById('propertyValue').value) || 0;
  const grossLoan = parseFloat(document.getElementById('grossLoan').value) || 0;
  const monthlyRate = parseFloat(document.getElementById('monthlyRate').value) || 0.85;
  const termMonths = parseInt(document.getElementById('termMonths').value, 10) || 12;
  const arrangementFeePercent = parseFloat(document.getElementById('arrangementFeePercent').value) || 2.0;
  const otherFees = parseFloat(document.getElementById('otherFees').value) || 0;
  const exitFeePercent = parseFloat(document.getElementById('exitFeePercent').value) || 0;
  const maxLtvPercent = parseFloat(document.getElementById('maxLtvPercent').value) || 75;

  const res = calcUkBridgingLoan({
    propertyValue,
    grossLoan,
    monthlyRate,
    termMonths,
    arrangementFeePercent,
    otherFees,
    exitFeePercent,
    maxLtvPercent
  });

  // Display hero results
  document.getElementById('resRetainedAdvance').textContent = fmtGBP(res.retained.netAdvanceDay1);
  document.getElementById('resRolledAdvance').textContent = fmtGBP(res.rolledUp.netAdvanceDay1);
  document.getElementById('resDay1Advantage').textContent = `+${fmtGBP(res.comparison.day1AdvanceAdvantage)} more cash Day-1 via Rolled-Up`;

  // Retained details
  document.getElementById('resRetainedInterest').textContent = fmtGBP(res.retained.interestTotal);
  document.getElementById('resRetainedRedemption').textContent = fmtGBP(res.retained.redemption);
  document.getElementById('resRetainedTotalCost').textContent = fmtGBP(res.retained.totalCost);
  document.getElementById('resRetainedRebate').textContent = fmtGBP(res.retained.earlyRedemptionRebate);

  // Rolled-up details
  document.getElementById('resRolledInterest').textContent = fmtGBP(res.rolledUp.interestTotal);
  document.getElementById('resRolledRedemption').textContent = fmtGBP(res.rolledUp.redemption);
  document.getElementById('resRolledTotalCost').textContent = fmtGBP(res.rolledUp.totalCost);
  document.getElementById('resRolledFinalLtv').textContent = `${res.rolledUp.finalLtv.toFixed(1)}% LTV`;

  // LTV Alerts
  const ltvWarning = document.getElementById('ltvWarningBox');
  if (res.isOverLtvCap || res.rolledUp.breachesLtv) {
    ltvWarning.style.display = 'block';
    document.getElementById('resLtvCapAmount').textContent = fmtGBP(res.ltvCapAmount);
  } else {
    ltvWarning.style.display = 'none';
  }

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const rDay1 = res.retained.netAdvanceDay1;
  const rRedeem = res.retained.redemption;
  const roDay1 = res.rolledUp.netAdvanceDay1;
  const roRedeem = res.rolledUp.redemption;
  const maxVal = Math.max(rRedeem, roRedeem, 1);
  const maxH = 140;

  const hRDay1 = Math.max(6, (rDay1 / maxVal) * maxH);
  const hRRedeem = Math.max(6, (rRedeem / maxVal) * maxH);
  const hRoDay1 = Math.max(6, (roDay1 / maxVal) * maxH);
  const hRoRedeem = Math.max(6, (roRedeem / maxVal) * maxH);

  setBar('barRDay1', 'lblRDay1', 25, hRDay1, rDay1);
  setBar('barRRedeem', 'lblRRedeem', 95, hRRedeem, rRedeem);
  setBar('barRoDay1', 'lblRoDay1', 175, hRoDay1, roDay1);
  setBar('barRoRedeem', 'lblRoRedeem', 245, hRoRedeem, roRedeem);
}

function setBar(barId, lblId, x, h, val) {
  const bar = document.getElementById(barId);
  const lbl = document.getElementById(lblId);
  if (bar) {
    bar.setAttribute('height', h.toFixed(1));
    bar.setAttribute('y', (170 - h).toFixed(1));
  }
  if (lbl) {
    lbl.textContent = fmtGBP(val);
    lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['propertyValue', 'grossLoan', 'monthlyRate', 'termMonths', 'arrangementFeePercent', 'otherFees', 'exitFeePercent', 'maxLtvPercent'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
