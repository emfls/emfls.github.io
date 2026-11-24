import { calcRrspEconomics, CRA_RRSP_CONSTANTS_2026 } from './model.mjs';

function formatCad(val) {
  return '$' + Math.round(val).toLocaleString('en-CA');
}

function updateCalculator() {
  const earnedIncome2025 = parseFloat(document.getElementById('in-earned-income').value) || 120000;
  const unusedRoomNoa = parseFloat(document.getElementById('in-unused-room').value) || 15000;
  const pensionAdjustment = parseFloat(document.getElementById('in-pension-adj').value) || 0;
  const contribution = parseFloat(document.getElementById('in-contribution').value) || 20000;
  const taxableIncome2026 = parseFloat(document.getElementById('in-income-2026').value) || 110000;
  const expectedIncome2027 = parseFloat(document.getElementById('in-income-2027').value) || 160000;
  const province = document.getElementById('in-province').value;
  const hurdleRate = parseFloat(document.getElementById('in-hurdle-rate').value) || 6.0;

  const res = calcRrspEconomics({
    earnedIncome2025,
    unusedRoomNoa,
    pensionAdjustment,
    contribution,
    taxableIncome2026,
    expectedIncome2027,
    province,
    hurdleRate
  });

  // Update KPI Cards
  document.getElementById('metric-refund').textContent = formatCad(res.totalRefund2026);
  document.getElementById('metric-limit').textContent = formatCad(res.totalRrspDeductionLimit);
  document.getElementById('metric-marginal-rate').textContent = res.effectiveMarginalTaxRelief.toFixed(1) + '%';
  document.getElementById('metric-gross-up').textContent = formatCad(res.grossUpRefund);

  // Update Breakdown Fields
  document.getElementById('out-new-room').textContent = formatCad(res.new2026Room);
  document.getElementById('out-carry-forward').textContent = formatCad(res.unusedRoomNoa);
  document.getElementById('out-total-limit').textContent = formatCad(res.totalRrspDeductionLimit);
  document.getElementById('out-deductible-contrib').textContent = formatCad(res.deductible2026);
  document.getElementById('out-2026-refund').textContent = formatCad(res.totalRefund2026);
  document.getElementById('out-effective-rate').textContent = res.effectiveMarginalTaxRelief.toFixed(1) + '%';
  document.getElementById('out-net-cost').textContent = formatCad(res.deductible2026 - res.totalRefund2026);

  // Strategy Comparison
  document.getElementById('out-strategy-rec').textContent = res.recommendation;
  document.getElementById('out-strategy-reason').textContent = res.recommendationReason;
  document.getElementById('out-nominal-2027-refund').textContent = formatCad(res.nominalRefund2027);
  document.getElementById('out-pv-2027-refund').textContent = formatCad(res.pvRefund2027);

  // Overcontribution Alert Box
  const alertBox = document.getElementById('box-overcontribution');
  if (res.excessContribution > 0) {
    alertBox.style.display = 'block';
    if (res.penaltySubjectAmount > 0) {
      alertBox.innerHTML = `🚨 <strong>Overcontribution Penalty Warning:</strong> Your contribution exceeds your limit by ${formatCad(res.excessContribution)}. After the $2,000 lifetime grace buffer, you will owe CRA approximately <strong>${formatCad(res.monthlyOvercontributionPenalty)}/month</strong> in Part X.1 (T1-OVP) penalty tax until withdrawn!`;
    } else {
      alertBox.innerHTML = `⚠️ <strong>Within $2,000 Lifetime Buffer:</strong> You have exceeded your limit by ${formatCad(res.excessContribution)}, but you are currently protected under the CRA $2,000 grace allowance. No monthly penalty applies, but excess contributions are non-deductible this year.`;
    }
  } else {
    alertBox.style.display = 'none';
  }

  // Gross-Up Strategy Box
  document.getElementById('out-grossup-contrib').textContent = formatCad(res.grossUpContribution);
  document.getElementById('out-grossup-loan').textContent = formatCad(res.grossUpLoanNeeded);
  document.getElementById('out-grossup-refund').textContent = formatCad(res.grossUpRefund);

  renderChart(res);
}

function renderChart(res) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  const totalDeductible = res.deductible2026;
  if (totalDeductible <= 0) return;

  const refundPct = Math.round((res.totalRefund2026 / totalDeductible) * 100);
  const netCostPct = Math.max(0, 100 - refundPct);

  const svg = `
  <svg viewBox="0 0 400 130" width="100%" height="130" style="display:block;font-family:system-ui,-apple-system,sans-serif;" role="img" aria-label="RRSP Contribution Economics Chart">
    <text x="0" y="16" fill="#9ca3af" font-size="11" font-weight="600">RRSP CAPITAL EFFICIENCY (CONTRIBUTION: ${formatCad(totalDeductible)})</text>
    
    <!-- Stacked bar -->
    <rect x="0" y="26" width="${netCostPct * 3.8}" height="28" fill="#3b82f6" rx="4" />
    <rect x="${netCostPct * 3.8}" y="26" width="${refundPct * 3.8}" height="28" fill="#10b981" rx="4" />
    
    <!-- Labels -->
    <text x="8" y="44" fill="#ffffff" font-size="12" font-weight="700">Net Out-of-Pocket: ${netCostPct}% (${formatCad(totalDeductible - res.totalRefund2026)})</text>
    <text x="392" y="44" fill="#ffffff" font-size="12" font-weight="700" text-anchor="end">CRA Refund: ${refundPct}% (${formatCad(res.totalRefund2026)})</text>
    
    <!-- Gross up comparison bar -->
    <text x="0" y="78" fill="#9ca3af" font-size="11" font-weight="600">WITH GROSS-UP LOAN STRATEGY (100% REINVESTED REFUND)</text>
    <rect x="0" y="88" width="380" height="24" fill="#6366f1" rx="4" />
    <text x="8" y="104" fill="#ffffff" font-size="11" font-weight="700">Total RRSP Asset: ${formatCad(res.grossUpContribution)} (Loan: ${formatCad(res.grossUpLoanNeeded)} Repaid by Refund!)</text>
  </svg>
  `;
  container.innerHTML = svg;
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = [
    'in-earned-income', 'in-unused-room', 'in-pension-adj',
    'in-contribution', 'in-income-2026', 'in-income-2027',
    'in-province', 'in-hurdle-rate'
  ];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateCalculator);
      el.addEventListener('change', updateCalculator);
    }
  });

  updateCalculator();
});
