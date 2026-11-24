import { calcVaVsConventional } from './model.mjs';

function formatUSD(val) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const homePrice = parseFloat(document.getElementById('home-price').value) || 450000;
  const downPct = (parseFloat(document.getElementById('down-payment').value) || 0) / 100;
  const isSubsequent = document.getElementById('usage-type').value === 'subsequent';
  const isExempt = document.getElementById('exempt-status').checked;
  const vaRate = (parseFloat(document.getElementById('va-rate').value) || 6.25) / 100;
  const convRate = (parseFloat(document.getElementById('conv-rate').value) || 6.75) / 100;
  const financeFee = document.getElementById('finance-fee').checked;
  const pmiRate = (parseFloat(document.getElementById('pmi-rate').value) || 0.68) / 100;

  try {
    const res = calcVaVsConventional({
      homePrice,
      downPaymentPct: downPct,
      isSubsequentUse: isSubsequent,
      isDisabledExempt: isExempt,
      vaInterestRate: vaRate,
      conventionalInterestRate: convRate,
      financeVaFundingFee: financeFee,
      conventionalPmiAnnualRate: pmiRate
    });

    // Populate Key Outputs
    document.getElementById('out-va-monthly').textContent = `${formatUSD(res.va.monthlyPmt)} / mo`;
    document.getElementById('out-conv-monthly').textContent = `${formatUSD(res.conventional.initialMonthlyTotal)} / mo`;
    document.getElementById('out-monthly-diff').textContent = `${formatUSD(res.comparison.monthlyDifference)} / mo`;
    
    document.getElementById('out-va-fee').textContent = `${formatUSD(res.va.fundingFeeDollar)} (${res.va.fundingFeePct.toFixed(2)}%)`;
    document.getElementById('out-pmi-monthly').textContent = `${formatUSD(res.conventional.monthlyPmi)} / mo`;
    document.getElementById('out-pmi-dropoff').textContent = res.conventional.pmiDropoffYears > 0 ? `Drops off in ~${res.conventional.pmiDropoffYears} yrs` : 'Zero PMI (>20% Down)';

    document.getElementById('out-5yr-savings').textContent = formatUSD(res.comparison.fiveYearSavingsVa);
    document.getElementById('out-lifetime-savings').textContent = formatUSD(res.comparison.lifetimeSavingsVa);

    if (res.comparison.exemptionDollarSavings > 0) {
      document.getElementById('exemption-banner').style.display = 'block';
      document.getElementById('out-exemption-savings').textContent = formatUSD(res.comparison.exemptionDollarSavings);
    } else {
      document.getElementById('exemption-banner').style.display = 'none';
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
  const padding = { top: 25, right: 30, bottom: 40, left: 140 };

  const items = [
    { label: 'VA Loan (5-Yr Cost)', val: res.va.fiveYearTotalCost, color: '#3b82f6' },
    { label: 'Conventional (5-Yr Cost)', val: res.conventional.fiveYearTotalCost, color: '#ef4444' }
  ];

  const maxVal = Math.max(res.va.fiveYearTotalCost, res.conventional.fiveYearTotalCost) * 1.15;
  const barHeight = 32;
  const gap = 25;

  const svgBars = items.map((item, i) => {
    const y = padding.top + i * (barHeight + gap);
    const barWidth = Math.max(0, (item.val / maxVal) * (width - padding.left - padding.right));
    return `
      <text x="${padding.left - 10}" y="${y + barHeight / 2 + 5}" fill="#9ca3af" font-size="11" text-anchor="end">${item.label}</text>
      <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${item.color}"/>
      <text x="${padding.left + barWidth + 8}" y="${y + barHeight / 2 + 5}" fill="#fff" font-size="11" font-weight="600">${formatUSD(item.val)}</text>
    `;
  }).join('');

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="5-Year Cumulative Cost Comparison">
      <line x1="${padding.left}" y1="${padding.top - 5}" x2="${padding.left}" y2="${height - padding.bottom + 5}" stroke="#374151" stroke-width="1"/>
      ${svgBars}
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#home-price, #down-payment, #usage-type, #exempt-status, #va-rate, #conv-rate, #finance-fee, #pmi-rate');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));
  document.getElementById('exempt-status').addEventListener('change', updateCalculator);
  document.getElementById('finance-fee').addEventListener('change', updateCalculator);

  updateCalculator();
});
