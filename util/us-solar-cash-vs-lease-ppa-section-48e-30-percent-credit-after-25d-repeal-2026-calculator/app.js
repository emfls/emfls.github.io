import { calcSolarCashVsLease } from './model.mjs';

const kwInput = document.getElementById('systemSizeKw');
const costInput = document.getElementById('grossSystemCost');
const utilRateInput = document.getElementById('utilityRateKwh');
const utilInfInput = document.getElementById('utilityInflationRate');
const leasePmtInput = document.getElementById('leaseYear1MonthlyPmt');
const leaseEscInput = document.getElementById('leaseEscalatorRate');
const loanRateInput = document.getElementById('loanInterestRate');

const resLost25d = document.getElementById('resLost25d');
const resSec48e = document.getElementById('resSec48e');
const resCash25Yr = document.getElementById('resCash25Yr');
const resLease25Yr = document.getElementById('resLease25Yr');
const resCashBreakEven = document.getElementById('resCashBreakEven');
const resBuyout25Yr = document.getElementById('resBuyout25Yr');
const chartSvg = document.getElementById('savingsChart');
const scheduleBody = document.getElementById('scheduleBody');

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function renderChart(data) {
  if (!chartSvg) return;
  const schedule = data.annualSchedule;
  const width = 560;
  const height = 240;
  const padLeft = 65;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(data.twentyFiveYearTotals.cashNetSavings, data.twentyFiveYearTotals.buyoutNetSavings, 50000);
  const minVal = -data.netCashCost;

  let svg = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="25-Year cumulative savings chart">`;
  svg += `<rect width="${width}" height="${height}" fill="#f8fafc" rx="8" />`;

  const yZero = padTop + plotH * (maxVal / (maxVal - minVal));
  svg += `<line x1="${padLeft}" y1="${yZero}" x2="${width - padRight}" y2="${yZero}" stroke="#94a3b8" stroke-dasharray="3" stroke-width="1" />`;

  function pointsFor(key) {
    return schedule.map((pt, i) => {
      const x = padLeft + (i / 24) * plotW;
      const y = padTop + plotH * ((maxVal - pt[key]) / (maxVal - minVal));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // Cash line (Blue)
  svg += `<polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pointsFor('cashCumulativeSavings')}" />`;
  // Lease line (Green)
  svg += `<polyline fill="none" stroke="#16a34a" stroke-width="2.5" stroke-dasharray="4" points="${pointsFor('leaseCumulativeSavings')}" />`;
  // Buyout line (Purple)
  svg += `<polyline fill="none" stroke="#8b5cf6" stroke-width="2.5" points="${pointsFor('buyoutCumulativeSavings')}" />`;

  // Year markers
  [1, 5, 10, 15, 20, 25].forEach(yr => {
    const x = padLeft + ((yr - 1) / 24) * plotW;
    svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + plotH}" stroke="#e2e8f0" stroke-width="1" />`;
    svg += `<text x="${x}" y="${padTop + plotH + 16}" font-size="10" text-anchor="middle" fill="#64748b" font-family="system-ui">Yr ${yr}</text>`;
  });

  svg += `</svg>`;
  chartSvg.innerHTML = svg;
}

function update() {
  try {
    const inputs = {
      systemSizeKw: parseFloat(kwInput.value) || 0,
      grossSystemCost: parseFloat(costInput.value) || 0,
      utilityRateKwh: parseFloat(utilRateInput.value) || 0,
      utilityInflationRate: (parseFloat(utilInfInput.value) || 0) / 100,
      leaseYear1MonthlyPmt: parseFloat(leasePmtInput.value) || 0,
      leaseEscalatorRate: (parseFloat(leaseEscInput.value) || 0) / 100,
      loanInterestRate: (parseFloat(loanRateInput.value) || 0) / 100,
      loanTermYears: 20,
      loanDealerFeePct: 0.15,
      tpoYear5BuyoutFmv: (parseFloat(costInput.value) || 0) * 0.38
    };

    const res = calcSolarCashVsLease(inputs);

    if (resLost25d) resLost25d.textContent = usd.format(res.grossSystemCost * 0.30);
    if (resSec48e) resSec48e.textContent = usd.format(res.sec48eCommercialCreditValue);
    if (resCash25Yr) resCash25Yr.textContent = usd.format(res.twentyFiveYearTotals.cashNetSavings);
    if (resLease25Yr) resLease25Yr.textContent = usd.format(res.twentyFiveYearTotals.leaseNetSavings);
    if (resCashBreakEven) resCashBreakEven.textContent = res.breakEven.cashYear ? `Year ${res.breakEven.cashYear}` : '> 25 Years';
    if (resBuyout25Yr) resBuyout25Yr.textContent = usd.format(res.twentyFiveYearTotals.buyoutNetSavings);

    if (scheduleBody) {
      const sampleYears = [1, 5, 10, 15, 20, 25];
      scheduleBody.innerHTML = res.annualSchedule.filter(s => sampleYears.includes(s.year)).map(s => `
        <tr>
          <td>Year ${s.year}</td>
          <td>${Math.round(s.solarKwh).toLocaleString()} kWh</td>
          <td>${usd.format(s.cashCumulativeSavings)}</td>
          <td>${usd.format(s.leaseCumulativeSavings)}</td>
          <td>${usd.format(s.buyoutCumulativeSavings)}</td>
        </tr>
      `).join('');
    }

    renderChart(res);
  } catch (err) {
    console.error(err);
  }
}

[kwInput, costInput, utilRateInput, utilInfInput, leasePmtInput, leaseEscInput, loanRateInput].forEach(el => {
  if (el) el.addEventListener('input', update);
});

update();
