import { calcHmrcPenaltiesAndInterest } from './model.mjs';

function formatGBP(val) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const tax = parseFloat(document.getElementById('input-tax').value) || 0;
  const daysFiling = parseInt(document.getElementById('input-days-filing').value, 10) || 0;
  const daysPayment = parseInt(document.getElementById('input-days-payment').value, 10) || 0;
  const hasTTP = document.getElementById('input-ttp').checked;
  const intRate = (parseFloat(document.getElementById('input-int-rate').value) || 8.0) / 100;

  try {
    const res = calcHmrcPenaltiesAndInterest({
      unpaidTax: tax,
      daysLateFiling: daysFiling,
      daysLatePayment: daysPayment,
      hasTimeToPayBefore30Days: hasTTP,
      annualInterestRate: intRate
    });

    // Populate Key Hero Outputs
    document.getElementById('out-total-extra').textContent = formatGBP(res.totals.totalExtraHmrcBill);
    document.getElementById('out-filing-pen').textContent = formatGBP(res.filing.totalFilingPenalty);
    document.getElementById('out-payment-pen').textContent = formatGBP(res.payment.totalPaymentPenalty);
    document.getElementById('out-interest').textContent = formatGBP(res.interest.interestAccrued);
    document.getElementById('out-total-due').textContent = formatGBP(res.totals.totalDueToHmrc);

    // Time to Pay Callout
    if (res.totals.ttpSavings > 0) {
      document.getElementById('box-ttp-active').style.display = 'block';
      document.getElementById('out-ttp-saved').textContent = formatGBP(res.totals.ttpSavings);
    } else {
      document.getElementById('box-ttp-active').style.display = 'none';
    }

    renderChart(res);

  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function renderChart(res) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  const width = 640;
  const height = 220;
  const padding = { top: 25, right: 35, bottom: 35, left: 165 };

  const items = [
    { label: 'Late Filing Penalty', val: res.filing.totalFilingPenalty, color: '#ef4444' },
    { label: 'Payment Surcharges', val: res.payment.totalPaymentPenalty, color: '#f59e0b' },
    { label: '8% Daily Interest', val: res.interest.interestAccrued, color: '#8b5cf6' },
    { label: 'Time-to-Pay Saved', val: res.totals.ttpSavings, color: '#10b981' }
  ];

  const maxVal = Math.max(...items.map(i => i.val), 100) * 1.2;
  const barHeight = 24;
  const gap = 18;

  const svgBars = items.map((item, i) => {
    const y = padding.top + i * (barHeight + gap);
    const barWidth = Math.max(0, (item.val / maxVal) * (width - padding.left - padding.right));
    return `
      <text x="${padding.left - 10}" y="${y + barHeight / 2 + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${item.label}</text>
      <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${item.color}"/>
      <text x="${padding.left + barWidth + 8}" y="${y + barHeight / 2 + 4}" fill="#fff" font-size="11" font-weight="600">${formatGBP(item.val)}</text>
    `;
  }).join('');

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="HMRC Penalties & Interest Breakdown Chart">
      <line x1="${padding.left}" y1="${padding.top - 5}" x2="${padding.left}" y2="${height - padding.bottom + 5}" stroke="#374151" stroke-width="1"/>
      ${svgBars}
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#input-tax, #input-days-filing, #input-days-payment, #input-ttp, #input-int-rate');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));
  document.getElementById('input-ttp').addEventListener('change', updateCalculator);

  updateCalculator();
});
