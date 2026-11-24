import { calcAcceleratedBiweeklyMortgage } from './model.mjs';

function formatCAD(val) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const principal = parseFloat(document.getElementById('mortgage-principal').value) || 550000;
  const rate = (parseFloat(document.getElementById('interest-rate').value) || 4.89) / 100;
  const amortYears = parseInt(document.getElementById('amort-years').value, 10) || 25;
  const lumpSum = parseFloat(document.getElementById('lump-sum').value) || 0;

  try {
    const res = calcAcceleratedBiweeklyMortgage({
      mortgagePrincipal: principal,
      annualInterestRate: rate,
      amortizationYears: amortYears,
      annualPrepaymentLumpSum: lumpSum
    });

    // Populate Key Outputs
    document.getElementById('out-monthly-pmt').textContent = `${formatCAD(res.baseMonthlyPayment)} / mo`;
    document.getElementById('out-acc-pmt').textContent = `${formatCAD(res.acceleratedBiweekly.paymentPerPeriod)} / 2-wks`;

    document.getElementById('out-interest-saved').textContent = formatCAD(res.savings.interestSavedAccelerated);
    document.getElementById('out-time-shaved').textContent = `${res.savings.timeSavedYears} Years Earlier!`;
    document.getElementById('out-acc-payoff').textContent = res.acceleratedBiweekly.payoffDisplay;
    document.getElementById('out-monthly-payoff').textContent = res.monthly.payoffDisplay;

    document.getElementById('out-y5-bal-monthly').textContent = formatCAD(res.monthly.balanceYear5);
    document.getElementById('out-y5-bal-acc').textContent = formatCAD(res.acceleratedBiweekly.balanceYear5);
    document.getElementById('out-y5-equity-boost').textContent = `+${formatCAD(res.savings.year5BalanceDifference)} More Principal Paid`;

    // Populate Comparison Table
    const tbody = document.getElementById('comparison-body');
    tbody.innerHTML = `
      <tr>
        <td><strong>Monthly (12/yr)</strong></td>
        <td>${formatCAD(res.baseMonthlyPayment)}</td>
        <td>${formatCAD(res.monthly.annualTotalPayment)}</td>
        <td>${res.monthly.payoffDisplay}</td>
        <td>${formatCAD(res.monthly.totalInterestPaid)}</td>
      </tr>
      <tr>
        <td><strong>Regular Bi-Weekly (26/yr)</strong></td>
        <td>${formatCAD(res.regularBiweekly.paymentPerPeriod)}</td>
        <td>${formatCAD(res.regularBiweekly.annualTotalPayment)}</td>
        <td>${res.regularBiweekly.payoffDisplay}</td>
        <td>${formatCAD(res.regularBiweekly.totalInterestPaid)}</td>
      </tr>
      <tr style="background:rgba(16,185,129,0.1);font-weight:600;">
        <td style="color:#10b981;">Accelerated Bi-Weekly</td>
        <td>${formatCAD(res.acceleratedBiweekly.paymentPerPeriod)}</td>
        <td>${formatCAD(res.acceleratedBiweekly.annualTotalPayment)}</td>
        <td style="color:#10b981;">${res.acceleratedBiweekly.payoffDisplay}</td>
        <td style="color:#10b981;">${formatCAD(res.acceleratedBiweekly.totalInterestPaid)}</td>
      </tr>
      ${lumpSum > 0 ? `
      <tr style="background:rgba(59,130,246,0.1);font-weight:600;">
        <td style="color:#3b82f6;">Accelerated + ${formatCAD(lumpSum)}/yr</td>
        <td>${formatCAD(res.acceleratedPlusLump.paymentPerPeriod)}</td>
        <td>${formatCAD(res.acceleratedPlusLump.annualTotalPayment)}</td>
        <td style="color:#3b82f6;">${res.acceleratedPlusLump.payoffDisplay}</td>
        <td style="color:#3b82f6;">${formatCAD(res.acceleratedPlusLump.totalInterestPaid)}</td>
      </tr>` : ''}
    `;

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
  const padding = { top: 25, right: 30, bottom: 35, left: 65 };

  const maxVal = res.mortgagePrincipal * 1.05;
  const maxYears = res.amortizationYears;

  const xScale = (yr) => padding.left + (yr / maxYears) * (width - padding.left - padding.right);
  const yScale = (bal) => height - padding.bottom - (bal / maxVal) * (height - padding.top - padding.bottom);

  let pathMonthly = `M ${xScale(0)} ${yScale(res.mortgagePrincipal)}`;
  res.monthly.balanceAtYears.forEach(pt => {
    pathMonthly += ` L ${xScale(pt.year)} ${yScale(pt.balance)}`;
  });

  let pathAcc = `M ${xScale(0)} ${yScale(res.mortgagePrincipal)}`;
  res.acceleratedBiweekly.balanceAtYears.forEach(pt => {
    pathAcc += ` L ${xScale(pt.year)} ${yScale(pt.balance)}`;
  });

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Canadian Mortgage Amortization Curve">
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="1"/>
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="1"/>

      <!-- Paths -->
      <path d="${pathMonthly}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="4 2"/>
      <path d="${pathAcc}" fill="none" stroke="#10b981" stroke-width="3"/>

      <!-- Labels -->
      <text x="${padding.left}" y="${height - 10}" fill="#9ca3af" font-size="11">Year 0</text>
      <text x="${xScale(maxYears)}" y="${height - 10}" fill="#9ca3af" font-size="11" text-anchor="end">Year ${maxYears}</text>
      <text x="${padding.left - 5}" y="${padding.top + 10}" fill="#9ca3af" font-size="10" text-anchor="end">${formatCAD(maxVal)}</text>
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#mortgage-principal, #interest-rate, #amort-years, #lump-sum');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));

  updateCalculator();
});
