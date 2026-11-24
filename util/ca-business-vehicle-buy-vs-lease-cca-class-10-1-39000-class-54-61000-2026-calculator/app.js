import { calcVehicleBuyVsLease, CRA_2026_LIMITS } from './model.mjs';

function formatCAD(val) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const vehicleType = document.getElementById('vehicle-type').value;
  const price = parseFloat(document.getElementById('purchase-price').value) || 58000;
  const leasePmt = parseFloat(document.getElementById('lease-payment').value) || 920;
  const interestPmt = parseFloat(document.getElementById('interest-payment').value) || 280;
  const bizKm = parseFloat(document.getElementById('business-km').value) || 18000;
  const personalKm = parseFloat(document.getElementById('personal-km').value) || 7000;
  const opCost = parseFloat(document.getElementById('operating-cost').value) || 4500;
  const corpTax = (parseFloat(document.getElementById('corp-tax').value) || 27) / 100;
  const personalTax = (parseFloat(document.getElementById('personal-tax').value) || 43) / 100;
  const isTerritory = document.getElementById('region').value === 'territory';

  try {
    const res = calcVehicleBuyVsLease({
      vehicleType,
      purchasePrice: price,
      monthlyLeasePayment: leasePmt,
      monthlyInterestPortion: interestPmt,
      annualBusinessKm: bizKm,
      annualPersonalKm: personalKm,
      annualOperatingCost: opCost,
      corporateTaxRate: corpTax,
      personalMarginalTaxRate: personalTax,
      isTerritory
    });

    // Populate Key Outputs
    document.getElementById('out-mileage-annual').textContent = `${formatCAD(res.summary.annualMileageReimbursement)} / yr`;
    document.getElementById('out-mileage-5yr').textContent = `${formatCAD(res.summary.total5YrMileageReimbursement)} (100% Tax-Free)`;
    document.getElementById('out-mileage-net').textContent = formatCAD(res.summary.netFamilyBenefitMileage);

    document.getElementById('out-buy-shield').textContent = formatCAD(res.summary.corpBuyTaxSavings);
    document.getElementById('out-buy-penalty').textContent = `-${formatCAD(res.summary.personalTaxPaidBuy)}`;
    document.getElementById('out-buy-net').textContent = formatCAD(res.summary.netFamilyBenefitBuy);

    document.getElementById('out-lease-shield').textContent = formatCAD(res.summary.corpLeaseTaxSavings);
    document.getElementById('out-lease-penalty').textContent = `-${formatCAD(res.summary.personalTaxPaidLease)}`;
    document.getElementById('out-lease-net').textContent = formatCAD(res.summary.netFamilyBenefitLease);

    document.getElementById('stat-biz-pct').textContent = `${res.summary.businessUsePct}% Business / ${res.summary.personalUsePct}% Personal`;

    // Populate CCA Table
    const tbody = document.getElementById('cca-body');
    tbody.innerHTML = '';
    res.ccaSchedule.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>Year ${row.year} ${row.year === 1 ? '(Half-Year 15%)' : '(30%)'}</td>
        <td>${formatCAD(row.ccaClaimed)}</td>
        <td>${formatCAD(row.endingUcc)}</td>
      `;
      tbody.appendChild(tr);
    });

    renderChart(res.summary);

  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function renderChart(summary) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 30, bottom: 40, left: 160 };

  const items = [
    { label: 'Personal + Mileage Allowance', val: summary.netFamilyBenefitMileage, color: '#10b981' },
    { label: 'Corporate Lease (Net)', val: summary.netFamilyBenefitLease, color: '#3b82f6' },
    { label: 'Corporate Buy (Net)', val: summary.netFamilyBenefitBuy, color: '#f59e0b' }
  ];

  const maxVal = Math.max(...items.map(d => Math.abs(d.val)), 10000) * 1.2;
  const barHeight = 28;
  const gap = 20;

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
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="5-Year Net Strategy Comparison">
      <line x1="${padding.left}" y1="${padding.top - 5}" x2="${padding.left}" y2="${height - padding.bottom + 5}" stroke="#374151" stroke-width="1"/>
      ${svgBars}
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#vehicle-type, #purchase-price, #lease-payment, #interest-payment, #business-km, #personal-km, #operating-cost, #corp-tax, #personal-tax, #region');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));

  document.getElementById('vehicle-type').addEventListener('change', (e) => {
    const isZev = e.target.value === 'zev';
    const ceilingNotice = document.getElementById('ceiling-notice');
    if (isZev) {
      ceilingNotice.textContent = 'Class 54 ZEV Ceiling: $61,000 before GST/HST';
    } else {
      ceilingNotice.textContent = 'Class 10.1 Ceiling: $39,000 before GST/HST (2026 limit)';
    }
    updateCalculator();
  });

  updateCalculator();
});
