import { calcBatteryPayback, calcBatteryStcRebate } from './model.mjs';

function formatAUD(val) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const capacity = parseFloat(document.getElementById('battery-capacity').value) || 13.5;
  const grossCost = parseFloat(document.getElementById('gross-cost').value) || 12800;
  const stateRebate = parseFloat(document.getElementById('state-rebate').value) || 0;
  const stcPrice = parseFloat(document.getElementById('stc-price').value) || 37.50;
  const dailyCycle = parseFloat(document.getElementById('daily-cycle').value) || 11.5;
  const peakRate = parseFloat(document.getElementById('peak-rate').value) || 0.42;
  const fitRate = parseFloat(document.getElementById('fit-rate').value) || 0.06;
  const efficiency = (parseFloat(document.getElementById('efficiency').value) || 90) / 100;
  const electInflation = (parseFloat(document.getElementById('elect-inflation').value) || 3.5) / 100;
  const degradation = (parseFloat(document.getElementById('degradation').value) || 1.5) / 100;

  try {
    const res = calcBatteryPayback({
      batteryCapacityKwh: capacity,
      grossInstalledCost: grossCost,
      stateRebateDollar: stateRebate,
      stcPrice,
      dailyCycledKwh: dailyCycle,
      peakTariffKwh: peakRate,
      feedInTariffKwh: fitRate,
      roundTripEfficiency: efficiency,
      electricityInflationRate: electInflation,
      batteryDegradationRate: degradation
    });

    // Populate Hero Output
    document.getElementById('out-rebate-2026').textContent = formatAUD(res.rebate2026.rebateDollar);
    document.getElementById('out-rebate-stcs').textContent = `${res.rebate2026.stcCount} STCs (${formatAUD(res.rebate2026.rebatePerUsableKwh)}/kWh)`;
    document.getElementById('out-waiting-penalty').textContent = `-${formatAUD(res.waitingPenalty)}`;
    document.getElementById('out-net-cost').textContent = formatAUD(res.netInstalledCost);
    document.getElementById('out-y1-savings').textContent = `${formatAUD(res.year1AnnualSavings)} / yr`;
    document.getElementById('out-payback').textContent = `${res.simplePaybackYears} yrs`;
    document.getElementById('out-10yr-profit').textContent = formatAUD(res.tenYearNetProfit);
    document.getElementById('out-10yr-roi').textContent = `${res.tenYearRoiPct}% ROI`;

    // Populate Schedule Table
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';
    res.yearlyBreakdown.forEach(row => {
      const tr = document.createElement('tr');
      const isPositive = row.netPosition >= 0;
      tr.innerHTML = `
        <td>Year ${row.year}</td>
        <td>${formatAUD(row.annualSavings)}</td>
        <td>${formatAUD(row.cumulativeSavings)}</td>
        <td style="color:${isPositive ? '#10b981' : '#ef4444'};font-weight:600;">${isPositive ? '+' : ''}${formatAUD(row.netPosition)}</td>
      `;
      tbody.appendChild(tr);
    });

    renderChart(res.yearlyBreakdown, res.netInstalledCost);

  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function renderChart(breakdown, netCost) {
  const container = document.getElementById('chart-container');
  if (!container || breakdown.length === 0) return;

  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };

  const maxVal = Math.max(...breakdown.map(d => d.cumulativeSavings), netCost * 1.2);
  const minVal = -netCost;

  const xScale = (i) => padding.left + (i / (breakdown.length - 1 || 1)) * (width - padding.left - padding.right);
  const yScale = (val) => height - padding.bottom - ((val - minVal) / (maxVal - minVal || 1)) * (height - padding.top - padding.bottom);

  const zeroY = yScale(0);

  let netPosPath = '';
  let cumSavingsPath = '';

  breakdown.forEach((pt, i) => {
    const x = xScale(i);
    const yNet = yScale(pt.netPosition);
    const yCum = yScale(pt.cumulativeSavings);

    if (i === 0) {
      netPosPath += `M ${x} ${yNet}`;
      cumSavingsPath += `M ${x} ${yCum}`;
    } else {
      netPosPath += ` L ${x} ${yNet}`;
      cumSavingsPath += ` L ${x} ${yCum}`;
    }
  });

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="10-Year Battery Payback Curve">
      <!-- Zero axis -->
      <line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="#4b5563" stroke-width="1.5" stroke-dasharray="2 2"/>
      
      <!-- Paths -->
      <path d="${cumSavingsPath}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>
      <path d="${netPosPath}" fill="none" stroke="#10b981" stroke-width="3"/>

      <!-- Break-even zero label -->
      <text x="${width - padding.right}" y="${zeroY - 5}" fill="#9ca3af" font-size="10" text-anchor="end">Break-even ($0)</text>

      <!-- Labels -->
      <text x="${padding.left}" y="${height - 10}" fill="#9ca3af" font-size="11">Year 1</text>
      <text x="${width - padding.right}" y="${height - 10}" fill="#9ca3af" font-size="11" text-anchor="end">Year 10</text>
      <text x="${padding.left - 5}" y="${padding.top + 10}" fill="#9ca3af" font-size="10" text-anchor="end">${formatAUD(maxVal)}</text>
      <text x="${padding.left - 5}" y="${height - padding.bottom}" fill="#ef4444" font-size="10" text-anchor="end">-${formatAUD(netCost)}</text>
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#battery-capacity, #gross-cost, #state-rebate, #stc-price, #daily-cycle, #peak-rate, #fit-rate, #efficiency, #elect-inflation, #degradation');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));

  document.getElementById('preset-battery').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'pw3') {
      document.getElementById('battery-capacity').value = '13.5';
      document.getElementById('gross-cost').value = '12800';
      document.getElementById('daily-cycle').value = '11.5';
    } else if (val === 'sungrow10') {
      document.getElementById('battery-capacity').value = '9.6';
      document.getElementById('gross-cost').value = '8900';
      document.getElementById('daily-cycle').value = '8.5';
    } else if (val === 'byd20') {
      document.getElementById('battery-capacity').value = '20.0';
      document.getElementById('gross-cost').value = '16500';
      document.getElementById('daily-cycle').value = '17.0';
    }
    updateCalculator();
  });

  updateCalculator();
});
