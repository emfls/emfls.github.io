import { calcTaxLossSelling, CRA_TAX_LOSS_CONSTANTS_2026 } from './model.mjs';

function formatCAD(val) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const loss = parseFloat(document.getElementById('input-loss').value) || 20000;
  const gains2026 = parseFloat(document.getElementById('input-gains-2026').value) || 0;
  const g2025 = parseFloat(document.getElementById('input-gains-2025').value) || 0;
  const g2024 = parseFloat(document.getElementById('input-gains-2024').value) || 0;
  const g2023 = parseFloat(document.getElementById('input-gains-2023').value) || 0;
  const prov = document.getElementById('input-prov').value;
  const tradeDt = document.getElementById('input-date').value || '2026-12-30';
  const isSuper = document.getElementById('input-superficial').checked;
  const isRegTrap = document.getElementById('input-reg-trap').checked;

  const defaultRates = CRA_TAX_LOSS_CONSTANTS_2026.provincialRates;
  const taxRate = defaultRates[prov] || 0.50;

  try {
    const res = calcTaxLossSelling({
      unrealizedLoss: loss,
      current2026Gains: gains2026,
      priorGains2025: g2025,
      priorGains2024: g2024,
      priorGains2023: g2023,
      province: prov,
      marginalTaxRate: taxRate,
      tradeDate: tradeDt,
      isSuperficialViolation: isSuper,
      isRegisteredAccountTrap: isRegTrap
    });

    // Populate Hero Stats
    document.getElementById('out-settle-date').textContent = res.dates.settlementDate;
    document.getElementById('out-rebuy-date').textContent = res.dates.safeRebuyDate;

    if (res.disallowedReason) {
      document.getElementById('box-disallowed').style.display = 'block';
      if (res.disallowedReason === 'PERMANENT_REGISTERED_DESTRUCTION') {
        document.getElementById('out-disallowed-msg').innerHTML = '🚨 <strong>PERMANENT LOSS DESTRUCTION:</strong> You transferred or repurchased in a TFSA/RRSP. Under ITA s. 54, the capital loss is denied AND cannot be added to registered ACB. Deduction is 100% lost forever!';
      } else if (res.disallowedReason === 'SUPERFICIAL_LOSS_DENIED') {
        document.getElementById('out-disallowed-msg').innerHTML = '⚠️ <strong>SUPERFICIAL LOSS DENIED:</strong> Shares repurchased within the 30-day window. Loss denied for 2026 (added to ACB of new shares).';
      } else {
        document.getElementById('out-disallowed-msg').innerHTML = '⏳ <strong>SETTLES IN 2027:</strong> Trades placed after Dec 30 settle in 2027 under T+1 rules. Loss cannot be claimed on 2026 return!';
      }
      document.getElementById('out-cash-recovery').textContent = '$0';
      document.getElementById('out-2026-savings').textContent = '$0';
      document.getElementById('out-t1a-refund').textContent = '$0';
      document.getElementById('out-carryforward').textContent = '$0';
    } else {
      document.getElementById('box-disallowed').style.display = 'none';
      document.getElementById('out-cash-recovery').textContent = formatCAD(res.totalTaxCashRecovery);
      document.getElementById('out-2026-savings').textContent = formatCAD(res.immediateTaxSavings);
      document.getElementById('out-t1a-refund').textContent = formatCAD(res.t1aCarryback.t1aTaxRefund);
      document.getElementById('out-carryforward').textContent = formatCAD(res.remainingLossCarryforward * 2); // Gross capital loss carryforward
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
    { label: '2026 Immediate Tax Saved', val: res.immediateTaxSavings || 0, color: '#10b981' },
    { label: 'Form T1A 3-Yr Refund', val: res.t1aCarryback ? res.t1aCarryback.t1aTaxRefund : 0, color: '#3b82f6' },
    { label: 'Total Cash Recovery', val: res.totalTaxCashRecovery || 0, color: '#8b5cf6' },
    { label: 'Remaining Loss (Gross)', val: (res.remainingLossCarryforward || 0) * 2, color: '#f59e0b' }
  ];

  const maxVal = Math.max(...items.map(i => i.val), 500) * 1.2;
  const barHeight = 22;
  const gap = 16;

  const svgBars = items.map((item, i) => {
    const y = padding.top + i * (barHeight + gap);
    const barWidth = Math.max(0, (item.val / maxVal) * (width - padding.left - padding.right));
    return `
      <text x="${padding.left - 10}" y="${y + barHeight / 2 + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${item.label}</text>
      <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${item.color}"/>
      <text x="${padding.left + barWidth + 8}" y="${y + barHeight / 2 + 4}" fill="#fff" font-size="11" font-weight="600">${formatCAD(item.val)}</text>
    `;
  }).join('');

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Tax Loss Selling Cash Flow Chart">
      <line x1="${padding.left}" y1="${padding.top - 5}" x2="${padding.left}" y2="${height - padding.bottom + 5}" stroke="#374151" stroke-width="1"/>
      ${svgBars}
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#input-loss, #input-gains-2026, #input-gains-2025, #input-gains-2024, #input-gains-2023, #input-prov, #input-date, #input-superficial, #input-reg-trap');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));
  document.getElementById('input-prov').addEventListener('change', updateCalculator);
  document.getElementById('input-superficial').addEventListener('change', updateCalculator);
  document.getElementById('input-reg-trap').addEventListener('change', updateCalculator);

  updateCalculator();
});
