import { computeEquityRelease } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n); }

function update() {
  const propVal = parseFloat(document.getElementById('propVal').value) || 450000;
  const release = parseFloat(document.getElementById('release').value) || 100000;
  const rate = parseFloat(document.getElementById('rate').value) / 100 || 0.061;
  const growth = parseFloat(document.getElementById('growth').value) / 100 || 0.03;
  const servicePct = parseFloat(document.getElementById('servicePct').value) || 1.0;

  const res = computeEquityRelease({
    propertyValue: propVal,
    initialRelease: release,
    interestRateAER: rate,
    propertyGrowthRate: growth,
    voluntaryInterestPct: servicePct
  });

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('outDoubling', res.doublingYears.toFixed(1) + ' Years');
  setEl('outMonthlyService', fmt(res.monthlyInterestCost100Pct * servicePct));
  
  const p15 = res.projections.find(p => p.year === 15);
  if (p15) {
    setEl('outRollup15', fmt(p15.rollupDebt));
    setEl('outProp15', fmt(p15.propertyValue));
    setEl('outSaved15', fmt(p15.equitySavedVsRollup));
  }

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  for (const p of res.projections) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Year ${p.year}</td>
      <td>${fmt(p.propertyValue)}</td>
      <td style="color:#c5221f;">${fmt(p.rollupDebt)}</td>
      <td>${fmt(p.rollupInheritance)}</td>
      <td style="color:#137333;">${fmt(p.servicedDebt)}</td>
      <td style="font-weight:bold;color:#137333;">${fmt(p.equitySavedVsRollup)}</td>
    `;
    tbody.appendChild(tr);
  }
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
