import { calcLeaveLoading, ATO_RATES_2026_27 } from './model.mjs';

function formatAud(val) {
  return '$' + Math.round(val).toLocaleString('en-AU');
}

function updateCalculator() {
  const annualSalary = parseFloat(document.getElementById('in-annual-salary').value) || 95000;
  const leaveWeeks = parseFloat(document.getElementById('in-leave-weeks').value) || 4;
  const loadingRate = parseFloat(document.getElementById('in-loading-rate').value) / 100.0;
  const payFrequency = document.getElementById('in-pay-frequency').value;
  const hasHecs = document.getElementById('in-has-hecs').checked;
  const isOvertimeExempt = document.getElementById('in-overtime-exempt').checked;

  const res = calcLeaveLoading({
    annualSalary,
    leaveWeeks,
    loadingRate,
    payFrequency,
    hasHecs,
    isOvertimeExempt
  });

  // Update Top Metric Cards
  document.getElementById('metric-net-pay').textContent = formatAud(res.netTakeHomeLeavePay);
  document.getElementById('metric-loading-amount').textContent = formatAud(res.leaveLoadingAmount);
  document.getElementById('metric-super').textContent = formatAud(res.totalSuperContribution);
  document.getElementById('metric-tax-withheld').textContent = formatAud(res.totalTaxWithheldOnLeavePay);

  // Update Breakdown Table
  document.getElementById('out-weekly-pay').textContent = formatAud(res.weeklyOrdinaryPay);
  document.getElementById('out-base-holiday-pay').textContent = formatAud(res.baseHolidayPay);
  document.getElementById('out-loading-amount').textContent = formatAud(res.leaveLoadingAmount);
  document.getElementById('out-gross-holiday-pay').textContent = formatAud(res.grossLeavePay);
  document.getElementById('out-tax-withheld').textContent = formatAud(res.totalTaxWithheldOnLeavePay);
  document.getElementById('out-net-pay').textContent = formatAud(res.netTakeHomeLeavePay);
  document.getElementById('out-super-base').textContent = formatAud(res.superOnBaseHolidayPay);
  document.getElementById('out-super-loading').textContent = formatAud(res.superOnLoading);
  document.getElementById('out-super-total').textContent = formatAud(res.totalSuperContribution);
  document.getElementById('out-loading-tax-rate').textContent = res.effectiveTaxRateOnLoading.toFixed(1) + '%';

  // Toggle Super Exemption Box
  const superBox = document.getElementById('box-super-status');
  if (res.isOvertimeExempt) {
    superBox.style.background = '#451a03';
    superBox.style.color = '#fde68a';
    superBox.innerHTML = `⚠️ <strong>Overtime Exemption Active:</strong> Loading is exempt from Super Guarantee under SGR 2009/2. Super is paid only on base holiday pay (${formatAud(res.superOnBaseHolidayPay)}).`;
  } else {
    superBox.style.background = '#064e3b';
    superBox.style.color = '#a7f3d0';
    superBox.innerHTML = `✅ <strong>Full 12.0% Super Guarantee Paid:</strong> Loading is classified as Ordinary Time Earnings (OTE). You receive an extra <strong>${formatAud(res.superOnLoading)}</strong> in super on your loading!`;
  }

  renderChart(res);
}

function renderChart(res) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  const totalGross = res.grossLeavePay;
  if (totalGross <= 0) return;

  const netPct = Math.round((res.netTakeHomeLeavePay / totalGross) * 100);
  const taxPct = 100 - netPct;

  const svg = `
  <svg viewBox="0 0 400 120" width="100%" height="120" style="display:block;font-family:system-ui,-apple-system,sans-serif;" role="img" aria-label="Leave Pay Breakdown Chart">
    <text x="0" y="16" fill="#9ca3af" font-size="11" font-weight="600">HOLIDAY PAYCHECK SPLIT (${res.leaveWeeks} WEEKS)</text>
    
    <!-- Stacked bar -->
    <rect x="0" y="26" width="${netPct * 3.8}" height="28" fill="#10b981" rx="4" />
    <rect x="${netPct * 3.8}" y="26" width="${taxPct * 3.8}" height="28" fill="#ef4444" rx="4" />
    
    <!-- Labels -->
    <text x="8" y="44" fill="#ffffff" font-size="12" font-weight="700">Take-Home: ${netPct}% (${formatAud(res.netTakeHomeLeavePay)})</text>
    <text x="392" y="44" fill="#ffffff" font-size="12" font-weight="700" text-anchor="end">Tax: ${taxPct}% (${formatAud(res.totalTaxWithheldOnLeavePay)})</text>
    
    <!-- Super Indicator bar below -->
    <text x="0" y="76" fill="#9ca3af" font-size="11" font-weight="600">+ MANDATORY 12.0% EMPLOYER SUPER (PAID ON TOP)</text>
    <rect x="0" y="86" width="380" height="14" fill="#3b82f6" rx="3" />
    <text x="8" y="97" fill="#ffffff" font-size="10" font-weight="600">Super Added: ${formatAud(res.totalSuperContribution)} (Base: ${formatAud(res.superOnBaseHolidayPay)} + Loading: ${formatAud(res.superOnLoading)})</text>
  </svg>
  `;
  container.innerHTML = svg;
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = [
    'in-annual-salary', 'in-leave-weeks', 'in-loading-rate',
    'in-pay-frequency', 'in-has-hecs', 'in-overtime-exempt'
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
