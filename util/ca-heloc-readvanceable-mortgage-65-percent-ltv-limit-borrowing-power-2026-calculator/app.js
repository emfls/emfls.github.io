import { calcHelocReadvanceable } from './model.mjs';

const homeValInput = document.getElementById('homeValue');
const mortBalInput = document.getElementById('mortgageBalance');
const mortRateInput = document.getElementById('mortgageRate');
const amortInput = document.getElementById('amortizationYears');
const helocRateInput = document.getElementById('helocRate');
const curHelocInput = document.getElementById('currentHelocBalance');

const resHelocLimit = document.getElementById('resHelocLimit');
const resAvailableNow = document.getElementById('resAvailableNow');
const resMonthlyPayment = document.getElementById('resMonthlyPayment');
const resStressPayment = document.getElementById('resStressPayment');
const res5YrExpansion = document.getElementById('res5YrExpansion');
const res5YrTotalLimit = document.getElementById('res5YrTotalLimit');
const resCrossMonth = document.getElementById('resCrossMonth');
const milestonesTable = document.getElementById('milestonesBody');
const chartSvg = document.getElementById('helocGrowthChart');

const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderChart(data) {
  if (!chartSvg) return;
  const schedule = data.schedule60;
  if (!schedule || schedule.length === 0) return;

  const width = 560;
  const height = 240;
  const padLeft = 70;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(data.osfi.maxCombinedBorrowing, data.homeValue * 0.85);

  let svg = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Readvanceable HELOC growth over 5 years">`;
  svg += `<rect width="${width}" height="${height}" fill="#f8fafc" rx="8" />`;

  // Draw 65% cap line
  const yCap65 = padTop + plotH * (1 - data.osfi.maxHelocCap / maxVal);
  svg += `<line x1="${padLeft}" y1="${yCap65}" x2="${width - padRight}" y2="${yCap65}" stroke="#dc2626" stroke-dasharray="4" stroke-width="1.5" />`;
  svg += `<text x="${padLeft + 5}" y="${yCap65 - 5}" font-size="10" fill="#dc2626" font-family="system-ui">OSFI 65% Cap (${cad.format(data.osfi.maxHelocCap)})</text>`;

  // Points for HELOC limit line
  const pts = schedule.map((pt, i) => {
    const x = padLeft + (i / 59) * plotW;
    const y = padTop + plotH * (1 - pt.helocLimit / maxVal);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  svg += `<polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pts}" />`;

  // Year markers
  [12, 24, 36, 48, 60].forEach(m => {
    const x = padLeft + ((m - 1) / 59) * plotW;
    svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + plotH}" stroke="#e2e8f0" stroke-width="1" />`;
    svg += `<text x="${x}" y="${padTop + plotH + 16}" font-size="11" text-anchor="middle" fill="#64748b" font-family="system-ui">Yr ${m / 12}</text>`;
  });

  svg += `</svg>`;
  chartSvg.innerHTML = svg;
}

function update() {
  try {
    const inputs = {
      homeValue: parseFloat(homeValInput.value) || 0,
      mortgageBalance: parseFloat(mortBalInput.value) || 0,
      mortgageRate: (parseFloat(mortRateInput.value) || 0) / 100,
      amortizationYears: parseInt(amortInput.value, 10) || 25,
      helocRate: (parseFloat(helocRateInput.value) || 0) / 100,
      currentHelocBalance: parseFloat(curHelocInput.value) || 0
    };

    const res = calcHelocReadvanceable(inputs);

    if (resHelocLimit) resHelocLimit.textContent = cad.format(res.osfi.initialHelocLimit);
    if (resAvailableNow) resAvailableNow.textContent = cad.format(res.osfi.availableHelocNow);
    if (resMonthlyPayment) resMonthlyPayment.textContent = cad.format(res.payments.monthlyPayment) + '/mo';
    if (resStressPayment) resStressPayment.textContent = cad.format(res.payments.stressMonthlyPayment) + `/mo (${pct.format(res.payments.stressRate)})`;

    if (res5YrExpansion) res5YrExpansion.textContent = '+' + cad.format(res.readvanceable.fiveYearHelocExpansion);
    if (res5YrTotalLimit) res5YrTotalLimit.textContent = cad.format(res.readvanceable.fiveYearHelocLimit);

    if (resCrossMonth) {
      if (res.osfi.currentMortgageLtv <= 65.0) {
        resCrossMonth.textContent = 'Already <= 65% LTV';
      } else if (res.readvanceable.crossesBelow65Month) {
        resCrossMonth.textContent = `Month ${res.readvanceable.crossesBelow65Month} (Year ${(res.readvanceable.crossesBelow65Month / 12).toFixed(1)})`;
      } else {
        resCrossMonth.textContent = '> 5 Years (60+ Months)';
      }
    }

    if (milestonesTable) {
      milestonesTable.innerHTML = res.readvanceable.milestones.map(m => `
        <tr>
          <td>Year ${m.year}</td>
          <td>${cad.format(m.balance)}</td>
          <td>${m.ltv.toFixed(1)}%</td>
          <td>${cad.format(m.helocLimit)}</td>
          <td>+${cad.format(m.helocExpansion)}</td>
        </tr>
      `).join('');
    }

    renderChart(res);
  } catch (err) {
    console.error(err);
  }
}

[homeValInput, mortBalInput, mortRateInput, amortInput, helocRateInput, curHelocInput].forEach(el => {
  if (el) el.addEventListener('input', update);
});

update();
