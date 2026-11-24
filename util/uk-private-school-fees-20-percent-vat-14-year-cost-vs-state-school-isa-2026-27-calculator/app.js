import { calcPrivateSchoolVsStateIsa, UK_TAX_BRACKETS } from './model.mjs';

function formatGBP(val) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const schoolType = document.getElementById('school-type').value;
  const baseTermFee = parseFloat(document.getElementById('base-term-fee').value) || 6226;
  const schoolAbsorption = (parseFloat(document.getElementById('school-absorption').value) || 0) / 100;
  const extrasRate = (parseFloat(document.getElementById('extras-rate').value) || 12) / 100;
  const numChildren = parseInt(document.getElementById('num-children').value, 10) || 1;
  const yearsRemaining = parseInt(document.getElementById('years-remaining').value, 10) || 7;
  const annualInflation = (parseFloat(document.getElementById('annual-inflation').value) || 5) / 100;
  const taxBracket = document.getElementById('tax-bracket').value;
  const isaReturn = (parseFloat(document.getElementById('isa-return').value) || 6.5) / 100;

  try {
    const res = calcPrivateSchoolVsStateIsa({
      schoolType,
      baseTermFee,
      vatRate: 0.20,
      schoolAbsorptionRate: schoolAbsorption,
      extrasRate,
      numberOfChildren: numChildren,
      yearsRemaining,
      annualFeeInflation: annualInflation,
      taxBracketKey: taxBracket,
      isaExpectedReturn: isaReturn
    });

    // Populate Key Outputs
    document.getElementById('out-total-fees').textContent = formatGBP(res.summary.totalNetFeesPaid);
    document.getElementById('out-vat-share').textContent = formatGBP(res.summary.totalVatPaid);
    document.getElementById('out-gross-salary').textContent = formatGBP(res.summary.totalGrossSalaryRequired);
    document.getElementById('out-tax-drag').textContent = formatGBP(res.summary.totalTaxDrag);
    document.getElementById('out-isa-wealth').textContent = formatGBP(res.summary.isaWealthAtGraduation);
    document.getElementById('out-opp-mult').textContent = `${res.summary.opportunityCostMultiple}x fees`;

    // Year 1 quick stat
    document.getElementById('stat-y1-fee').textContent = formatGBP(res.year1.annualNetFee);
    document.getElementById('stat-y1-gross').textContent = formatGBP(res.year1.annualGrossNeeded);
    document.getElementById('stat-y1-vat').textContent = formatGBP(res.year1.annualVat);

    // Populate Breakdown Table
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';
    res.yearlyBreakdown.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>Year ${row.year}</td>
        <td>${formatGBP(row.annualNetFee)}</td>
        <td>${formatGBP(row.annualVat)}</td>
        <td><strong>${formatGBP(row.annualGrossNeeded)}</strong></td>
        <td style="color:#10b981;font-weight:600;">${formatGBP(row.isaPortfolioValue)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Render SVG Comparison Chart
    renderChart(res.yearlyBreakdown);

  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function renderChart(breakdown) {
  const container = document.getElementById('chart-container');
  if (!container || breakdown.length === 0) return;

  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };

  const maxVal = Math.max(
    breakdown[breakdown.length - 1].cumulativeGrossSalary,
    breakdown[breakdown.length - 1].isaPortfolioValue
  ) * 1.1;

  const xScale = (i) => padding.left + (i / (breakdown.length - 1 || 1)) * (width - padding.left - padding.right);
  const yScale = (val) => height - padding.bottom - (val / (maxVal || 1)) * (height - padding.top - padding.bottom);

  // Line paths
  let feesPath = '';
  let grossPath = '';
  let isaPath = '';

  breakdown.forEach((pt, i) => {
    const x = xScale(i);
    const yFee = yScale(pt.cumulativeNetFee);
    const yGross = yScale(pt.cumulativeGrossSalary);
    const yIsa = yScale(pt.isaPortfolioValue);

    if (i === 0) {
      feesPath += `M ${x} ${yFee}`;
      grossPath += `M ${x} ${yGross}`;
      isaPath += `M ${x} ${yIsa}`;
    } else {
      feesPath += ` L ${x} ${yFee}`;
      grossPath += ` L ${x} ${yGross}`;
      isaPath += ` L ${x} ${yIsa}`;
    }
  });

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="School fees vs ISA wealth projection">
      <defs>
        <linearGradient id="isaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <!-- Grid lines -->
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="1"/>
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="1"/>
      
      <!-- Paths -->
      <path d="${feesPath}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="4 2"/>
      <path d="${grossPath}" fill="none" stroke="#ef4444" stroke-width="2.5"/>
      <path d="${isaPath}" fill="none" stroke="#10b981" stroke-width="3"/>

      <!-- Axes Labels -->
      <text x="${padding.left}" y="${height - 10}" fill="#9ca3af" font-size="11">Year 1</text>
      <text x="${width - padding.right}" y="${height - 10}" fill="#9ca3af" font-size="11" text-anchor="end">Year ${breakdown.length}</text>
      <text x="${padding.left - 5}" y="${padding.top + 10}" fill="#9ca3af" font-size="10" text-anchor="end">${formatGBP(maxVal)}</text>
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#school-type, #base-term-fee, #school-absorption, #extras-rate, #num-children, #years-remaining, #annual-inflation, #tax-bracket, #isa-return');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));

  document.getElementById('school-type').addEventListener('change', (e) => {
    const feeInput = document.getElementById('base-term-fee');
    if (e.target.value === 'boarding') {
      feeInput.value = '14980';
    } else {
      feeInput.value = '6226';
    }
    updateCalculator();
  });

  updateCalculator();
});
