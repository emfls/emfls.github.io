import { calcInterestOnlyVsPandI, ATO_MARGINAL_TAX_RATES } from './model.mjs';

function formatAUD(val) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const loan = parseFloat(document.getElementById('loan-amount').value) || 750000;
  const ioYears = parseInt(document.getElementById('io-years').value, 10) || 5;
  const piRate = (parseFloat(document.getElementById('pi-rate').value) || 6.05) / 100;
  const ioRate = (parseFloat(document.getElementById('io-rate').value) || 6.35) / 100;
  const taxRate = parseFloat(document.getElementById('tax-bracket').value) || 0.39;
  const pporOffset = document.getElementById('ppor-offset').checked;
  const pporRate = (parseFloat(document.getElementById('ppor-rate').value) || 5.95) / 100;

  try {
    const res = calcInterestOnlyVsPandI({
      loanAmount: loan,
      loanTermYears: 30,
      ioPeriodYears: ioYears,
      pAndIInterestRate: piRate,
      ioInterestRate: ioRate,
      marginalTaxRate: taxRate,
      redirectSurplusToPporOffset: pporOffset,
      pporMortgageRate: pporRate
    });

    // Populate Key Outputs
    document.getElementById('out-io-monthly').textContent = `${formatAUD(res.monthlyIoPmt)} / mo`;
    document.getElementById('out-cliff-monthly').textContent = `${formatAUD(res.year6PostIoPmt)} / mo`;
    document.getElementById('out-cliff-jump').textContent = `+${formatAUD(res.cliffDollarIncrease)} / mo (+${res.cliffPctIncrease}%)`;

    document.getElementById('out-pi-monthly').textContent = `${formatAUD(res.standardPAndIPmt)} / mo`;
    document.getElementById('out-cashflow-gap').textContent = `${formatAUD(res.initialMonthlyCashFlowAdvantage)} / mo`;
    document.getElementById('out-tax-advantage').textContent = formatAUD(res.tenYearSummary.taxShieldAdvantageIo);

    if (pporOffset) {
      document.getElementById('ppor-notice').style.display = 'block';
      document.getElementById('out-ppor-saved').textContent = formatAUD(res.tenYearSummary.pporInterestSaved);
    } else {
      document.getElementById('ppor-notice').style.display = 'none';
    }

    // Populate Table
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';
    res.yearlyBreakdown.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>Year ${row.year} ${row.isIo ? '<span style="color:#f59e0b">(IO)</span>' : '<span style="color:#10b981">(P&I)</span>'}</td>
        <td style="font-weight:600;color:${row.isIo ? '#f59e0b' : '#ef4444'}">${formatAUD(row.monthlyPmtIo)}</td>
        <td>${formatAUD(row.monthlyPmtPi)}</td>
        <td>${formatAUD(row.loanBalIo)}</td>
        <td>${formatAUD(row.loanBalPi)}</td>
      `;
      tbody.appendChild(tr);
    });

    renderChart(res);

  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function renderChart(res) {
  const container = document.getElementById('chart-container');
  if (!container || res.yearlyBreakdown.length === 0) return;

  const width = 640;
  const height = 220;
  const padding = { top: 25, right: 30, bottom: 35, left: 65 };

  const maxVal = Math.max(...res.yearlyBreakdown.map(d => Math.max(d.monthlyPmtIo, d.monthlyPmtPi))) * 1.15;
  const xScale = (i) => padding.left + (i / (res.yearlyBreakdown.length - 1 || 1)) * (width - padding.left - padding.right);
  const yScale = (val) => height - padding.bottom - (val / (maxVal || 1)) * (height - padding.top - padding.bottom);

  let ioPath = '';
  let piPath = '';

  res.yearlyBreakdown.forEach((pt, i) => {
    const x = xScale(i);
    const yIo = yScale(pt.monthlyPmtIo);
    const yPi = yScale(pt.monthlyPmtPi);

    if (i === 0) {
      ioPath += `M ${x} ${yIo}`;
      piPath += `M ${x} ${yPi}`;
    } else {
      ioPath += ` L ${x} ${yIo}`;
      piPath += ` L ${x} ${yPi}`;
    }
  });

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Monthly Repayment Cliff Trajectory">
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="1"/>
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="1"/>
      
      <path d="${piPath}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="4 2"/>
      <path d="${ioPath}" fill="none" stroke="#ef4444" stroke-width="3"/>

      <!-- Labels -->
      <text x="${padding.left}" y="${height - 10}" fill="#9ca3af" font-size="11">Year 1</text>
      <text x="${xScale(4)}" y="${height - 10}" fill="#f59e0b" font-size="11" text-anchor="middle">Year 5 (Cliff)</text>
      <text x="${width - padding.right}" y="${height - 10}" fill="#9ca3af" font-size="11" text-anchor="end">Year 10</text>
      <text x="${padding.left - 5}" y="${padding.top + 10}" fill="#9ca3af" font-size="10" text-anchor="end">${formatAUD(maxVal)}</text>
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#loan-amount, #io-years, #pi-rate, #io-rate, #tax-bracket, #ppor-offset, #ppor-rate');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));
  document.getElementById('ppor-offset').addEventListener('change', updateCalculator);

  updateCalculator();
});
