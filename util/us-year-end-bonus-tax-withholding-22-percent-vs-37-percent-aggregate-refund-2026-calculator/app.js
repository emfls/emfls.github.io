import { calcBonusTax } from './model.mjs';

function formatUSD(val) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const salary = parseFloat(document.getElementById('input-salary').value) || 120000;
  const ytd = parseFloat(document.getElementById('input-ytd').value) || 110000;
  const bonus = parseFloat(document.getElementById('input-bonus').value) || 25000;
  const filingStatus = document.getElementById('input-status').value;
  const payFreq = document.getElementById('input-freq').value;
  const deferralPct = (parseFloat(document.getElementById('input-401k-pct').value) || 0) / 100;
  const prior401k = parseFloat(document.getElementById('input-prior-401k').value) || 0;

  try {
    const res = calcBonusTax({
      regularSalary: salary,
      priorYtdWages: ytd,
      bonusAmount: bonus,
      filingStatus,
      payFrequency: payFreq,
      bonus401kPercent: deferralPct,
      prior401kContributions: prior401k
    });

    // Populate Key Takeaways
    document.getElementById('out-flat-takehome').textContent = formatUSD(res.flatMethod.netTakeHome);
    document.getElementById('out-flat-withheld').textContent = formatUSD(res.flatMethod.federalWithholding);
    document.getElementById('out-agg-takehome').textContent = formatUSD(res.aggregateMethod.netTakeHome);
    document.getElementById('out-agg-withheld').textContent = formatUSD(res.aggregateMethod.federalWithholding);

    // FICA
    document.getElementById('out-ss-tax').textContent = formatUSD(res.fica.socialSecurityTax);
    document.getElementById('out-ss-status').textContent = res.fica.ssExemptWages > 0 
      ? `(${formatUSD(res.fica.ssExemptWages)} exempt above $184.5k!)` 
      : '(Full 6.2% applied)';
    document.getElementById('out-medicare-tax').textContent = formatUSD(res.fica.totalMedicareTax);
    if (res.fica.addlMedicareTax > 0) {
      document.getElementById('out-medicare-status').textContent = `(Incl. ${formatUSD(res.fica.addlMedicareTax)} 0.9% Addl)`;
    } else {
      document.getElementById('out-medicare-status').textContent = '(Standard 1.45%)';
    }

    // True Tax & April 2027 Reconciliation
    document.getElementById('out-true-tax').textContent = `${formatUSD(res.trueLiability.marginalTax)} (${res.trueLiability.effectiveBonusRate.toFixed(1)}%)`;
    
    // Flat method refund/owed
    if (res.flatMethod.isRefund) {
      document.getElementById('out-flat-reconcile').innerHTML = `<span style="color:var(--success);font-weight:600;">+$${res.flatMethod.refundOrOwed.toLocaleString('en-US')} Estimated Refund</span> (April 2027)`;
    } else {
      document.getElementById('out-flat-reconcile').innerHTML = `<span style="color:var(--danger);font-weight:600;">-$${res.flatMethod.refundOrOwed.toLocaleString('en-US')} Under-Withheld Due</span> (April 2027)`;
    }

    // Aggregate method refund/owed
    if (res.aggregateMethod.isRefund) {
      document.getElementById('out-agg-reconcile').innerHTML = `<span style="color:var(--success);font-weight:600;">+$${res.aggregateMethod.refundOrOwed.toLocaleString('en-US')} Estimated Refund</span> (April 2027)`;
    } else {
      document.getElementById('out-agg-reconcile').innerHTML = `<span style="color:var(--danger);font-weight:600;">-$${res.aggregateMethod.refundOrOwed.toLocaleString('en-US')} Under-Withheld Due</span> (April 2027)`;
    }

    // 401(k) Deferral callout
    if (res.bonus401kDeferral > 0) {
      document.getElementById('box-401k-deferral').style.display = 'block';
      document.getElementById('out-401k-saved').textContent = formatUSD(res.bonus401kDeferral);
    } else {
      document.getElementById('box-401k-deferral').style.display = 'none';
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
  const height = 240;
  const padding = { top: 25, right: 35, bottom: 35, left: 165 };

  const items = [
    { label: 'Flat 22% Net Cash', val: res.flatMethod.netTakeHome, color: '#10b981' },
    { label: 'Aggregate Net Cash', val: res.aggregateMethod.netTakeHome, color: '#3b82f6' },
    { label: 'Flat Fed Withheld', val: res.flatMethod.federalWithholding, color: '#f59e0b' },
    { label: 'Aggregate Fed Withheld', val: res.aggregateMethod.federalWithholding, color: '#ef4444' },
    { label: 'True Marginal Tax', val: res.trueLiability.marginalTax, color: '#8b5cf6' }
  ];

  const maxVal = Math.max(...items.map(i => i.val)) * 1.18;
  const barHeight = 22;
  const gap = 16;

  const svgBars = items.map((item, i) => {
    const y = padding.top + i * (barHeight + gap);
    const barWidth = Math.max(0, (item.val / maxVal) * (width - padding.left - padding.right));
    return `
      <text x="${padding.left - 10}" y="${y + barHeight / 2 + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${item.label}</text>
      <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${item.color}"/>
      <text x="${padding.left + barWidth + 8}" y="${y + barHeight / 2 + 4}" fill="#fff" font-size="11" font-weight="600">${formatUSD(item.val)}</text>
    `;
  }).join('');

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Bonus Withholding Comparison Chart">
      <line x1="${padding.left}" y1="${padding.top - 5}" x2="${padding.left}" y2="${height - padding.bottom + 5}" stroke="#374151" stroke-width="1"/>
      ${svgBars}
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#input-salary, #input-ytd, #input-bonus, #input-status, #input-freq, #input-401k-pct, #input-prior-401k');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));
  document.getElementById('input-status').addEventListener('change', updateCalculator);
  document.getElementById('input-freq').addEventListener('change', updateCalculator);

  updateCalculator();
});
