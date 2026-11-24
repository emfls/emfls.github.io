import { calcSharedOwnership } from './model.mjs';

function formatGBP(val) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const fmv = parseFloat(document.getElementById('full-fmv').value) || 350000;
  const initialShare = (parseFloat(document.getElementById('initial-share').value) || 40) / 100;
  const depositPct = (parseFloat(document.getElementById('deposit-pct').value) || 5) / 100;
  const rate = (parseFloat(document.getElementById('mortgage-rate').value) || 5.2) / 100;
  const term = parseInt(document.getElementById('mortgage-term').value, 10) || 25;
  const rentRate = (parseFloat(document.getElementById('rent-rate').value) || 2.75) / 100;
  const serviceCharge = parseFloat(document.getElementById('service-charge').value) || 150;
  const isFtb = document.getElementById('is-ftb').checked;
  const growthRate = (parseFloat(document.getElementById('property-growth').value) || 3.0) / 100;
  const staircaseYear = parseInt(document.getElementById('staircase-year').value, 10) || 5;
  const staircaseShare = (parseFloat(document.getElementById('staircase-share').value) || 25) / 100;

  try {
    const res = calcSharedOwnership({
      fullMarketValue: fmv,
      initialSharePct: initialShare,
      buyerDepositPct: depositPct,
      mortgageInterestRate: rate,
      mortgageTermYears: term,
      housingAssocRentRate: rentRate,
      monthlyServiceCharge: serviceCharge,
      isFirstTimeBuyer: isFtb,
      annualPropertyGrowth: growthRate,
      staircaseYear,
      staircaseSharePct: staircaseShare
    });

    // Populate Key Outputs
    document.getElementById('out-total-monthly').textContent = `${formatGBP(res.initialTotalMonthly)} / mo`;
    document.getElementById('out-breakdown').textContent = `Mortgage: ${formatGBP(res.initialMonthlyMortgage)} | Rent: ${formatGBP(res.initialMonthlyRent)} | Service: ${formatGBP(res.monthlyServiceCharge)}`;
    
    document.getElementById('out-sdlt-staged').textContent = formatGBP(res.sdlt.stagedOptionUpfront);
    document.getElementById('out-sdlt-mv').textContent = formatGBP(res.sdlt.marketValueOption);
    document.getElementById('out-sdlt-winner').textContent = `${res.sdlt.winner} (Saves ${formatGBP(res.sdlt.sdltSavings)})`;

    document.getElementById('out-staircase-cost').textContent = formatGBP(res.staircasing.totalOutlay);
    document.getElementById('out-new-rent').textContent = `${formatGBP(res.staircasing.newMonthlyRent)} / mo (Saves ${formatGBP(res.staircasing.monthlyRentReduction)}/mo)`;
    document.getElementById('out-future-fmv').textContent = `Future FMV in Yr ${res.staircasing.year}: ${formatGBP(res.staircasing.futureFmv)}`;

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
  const padding = { top: 25, right: 30, bottom: 40, left: 160 };

  const items = [
    { label: 'Market Value Election SDLT', val: res.sdlt.totalSdltOptionA, color: '#3b82f6' },
    { label: 'Staged Payments Total SDLT', val: res.sdlt.totalSdltOptionB, color: '#f59e0b' }
  ];

  const maxVal = Math.max(res.sdlt.totalSdltOptionA, res.sdlt.totalSdltOptionB, 1000) * 1.25;
  const barHeight = 30;
  const gap = 25;

  const svgBars = items.map((item, i) => {
    const y = padding.top + i * (barHeight + gap);
    const barWidth = Math.max(0, (item.val / maxVal) * (width - padding.left - padding.right));
    return `
      <text x="${padding.left - 10}" y="${y + barHeight / 2 + 5}" fill="#9ca3af" font-size="11" text-anchor="end">${item.label}</text>
      <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${item.color}"/>
      <text x="${padding.left + barWidth + 8}" y="${y + barHeight / 2 + 5}" fill="#fff" font-size="11" font-weight="600">${formatGBP(item.val)}</text>
    `;
  }).join('');

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="SDLT Strategy Cost Comparison">
      <line x1="${padding.left}" y1="${padding.top - 5}" x2="${padding.left}" y2="${height - padding.bottom + 5}" stroke="#374151" stroke-width="1"/>
      ${svgBars}
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#full-fmv, #initial-share, #deposit-pct, #mortgage-rate, #mortgage-term, #rent-rate, #service-charge, #is-ftb, #property-growth, #staircase-year, #staircase-share');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));
  document.getElementById('is-ftb').addEventListener('change', updateCalculator);

  updateCalculator();
});
