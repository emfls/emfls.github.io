import { calcUkBusinessRates2026 } from './model.mjs';

function fmtGBP(val) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const rateableValue = parseFloat(document.getElementById('rateableValue').value) || 0;
  const isRHL = document.getElementById('isRHL').value === 'true';
  const isSingleProperty = document.getElementById('isSingleProperty').value === 'true';
  const cityOfLondonPremium = document.getElementById('cityOfLondonPremium').value === 'true';

  const res = calcUkBusinessRates2026({
    rateableValue,
    isRHL,
    isSingleProperty,
    cityOfLondonPremium
  });

  document.getElementById('multiplierBadge').textContent = `${res.multiplierName} (${res.multiplierPence}p)`;
  document.getElementById('grossBill').textContent = fmtGBP(res.grossBill2026);
  document.getElementById('sbrrDiscount').textContent = res.sbrrPercent > 0 ? `-${fmtGBP(res.sbrrDiscount)} (${res.sbrrPercent}%)` : '£0 (0%)';
  document.getElementById('netBill').textContent = fmtGBP(res.netBill2026);
  document.getElementById('monthlyInstalment').textContent = `${fmtGBP(res.monthlyBill2026)} / month (10 instalments)`;

  document.getElementById('oldNetBill').textContent = fmtGBP(res.oldNetBill);

  const verdictEl = document.getElementById('comparisonSummary');
  if (res.savingsVsOld > 0) {
    verdictEl.innerHTML = `<span class="badge badge-success">SAVINGS: ${fmtGBP(res.savingsVsOld)} / YEAR</span> The new ${res.multiplierPence}p multiplier reduces your annual business rates liability by <strong>${Math.abs(res.percentChange)}%</strong> compared to the previous two-tier system!`;
  } else if (res.savingsVsOld < 0) {
    verdictEl.innerHTML = `<span class="badge badge-warning">INCREASE: +${fmtGBP(Math.abs(res.savingsVsOld))} / YEAR</span> Due to the expiry of the temporary 40% retail discount, your net payable bill increases by <strong>${res.percentChange}%</strong> under the permanent ${res.multiplierPence}p rate.`;
  } else {
    verdictEl.innerHTML = `<span class="badge badge-primary">ZERO BILL (100% RELIEF)</span> Under 2026/27 SBRR rules, small properties with RV ≤ £12,000 pay £0 in business rates!`;
  }

  renderChart(res);
}

function renderChart(res) {
  const svg = document.getElementById('ratesChart');
  if (!svg) return;
  const maxVal = Math.max(res.netBill2026, res.oldNetBill, 1000) * 1.2;
  const newH = maxVal > 0 ? (res.netBill2026 / maxVal) * 160 : 0;
  const oldH = maxVal > 0 ? (res.oldNetBill / maxVal) * 160 : 0;
  const newY = 190 - newH;
  const oldY = 190 - oldH;

  svg.innerHTML = `
    <rect x="0" y="0" width="100%" height="220" fill="#f8fafc" rx="8"/>
    <line x1="40" y1="190" x2="380" y2="190" stroke="#cbd5e1" stroke-width="2"/>
    <!-- 2025/26 Old Bill -->
    <rect x="80" y="${oldY}" width="90" height="${oldH}" fill="#94a3b8" rx="4"/>
    <text x="125" y="${oldY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">${fmtGBP(res.oldNetBill)}</text>
    <text x="125" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">2025/26 Old Bill</text>
    <!-- 2026/27 New Bill -->
    <rect x="230" y="${newY}" width="90" height="${newH}" fill="#0284c7" rx="4"/>
    <text x="275" y="${newY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#0284c7">${fmtGBP(res.netBill2026)}</text>
    <text x="275" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">2026/27 New Bill</text>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = ['rateableValue', 'isRHL', 'isSingleProperty', 'cityOfLondonPremium'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateCalculator);
      el.addEventListener('change', updateCalculator);
    }
  });
  updateCalculator();
});
