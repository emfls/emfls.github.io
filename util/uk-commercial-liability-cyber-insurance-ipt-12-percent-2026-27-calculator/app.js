import { calcUkCommercialInsurance, INDUSTRY_RISK_PROFILES } from './model.mjs';

function fmtGBP(val) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const industry = document.getElementById('industry').value;
  const employeeCount = parseInt(document.getElementById('employeeCount').value, 10) || 0;
  const turnover = parseFloat(document.getElementById('turnover').value) || 0;
  const hasEL = document.getElementById('hasEL').checked;
  const plLimit = document.getElementById('plLimit').value;
  const hasPI = document.getElementById('hasPI').checked;
  const hasCyber = document.getElementById('hasCyber').checked;

  const res = calcUkCommercialInsurance({
    industry,
    employeeCount,
    turnover,
    hasEL,
    plLimit,
    hasPI,
    hasCyber
  });

  // Display results
  document.getElementById('resTotalAnnual').textContent = fmtGBP(res.totalAnnualPremium);
  document.getElementById('resMonthly').textContent = fmtGBP(res.monthlyPremium);
  document.getElementById('resNetPremium').textContent = fmtGBP(res.netPremium);
  document.getElementById('resIptAmount').textContent = fmtGBP(res.iptAmount);

  // Cover breakdowns
  document.getElementById('resElCover').textContent = res.elPremium > 0 ? fmtGBP(res.elPremium) : '£0 (None)';
  document.getElementById('resPlCover').textContent = res.plPremium > 0 ? fmtGBP(res.plPremium) : '£0 (None)';
  document.getElementById('resPiCover').textContent = res.piPremium > 0 ? fmtGBP(res.piPremium) : '£0 (None)';
  document.getElementById('resCyberCover').textContent = res.cyberPremium > 0 ? fmtGBP(res.cyberPremium) : '£0 (None)';

  // Compliance Alert Box
  const alertBox = document.getElementById('complianceAlert');
  if (!res.elCompliant) {
    alertBox.style.display = 'block';
    document.getElementById('resFineAmount').textContent = fmtGBP(res.potentialMonthlyFineExposure);
  } else {
    alertBox.style.display = 'none';
  }

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const el = res.elPremium;
  const pl = res.plPremium;
  const pi = res.piPremium;
  const cyber = res.cyberPremium;
  const ipt = res.iptAmount;
  const total = Math.max(res.totalAnnualPremium, 1);

  const maxBarH = 140;
  const hEl = Math.max(4, (el / total) * maxBarH);
  const hPl = Math.max(4, (pl / total) * maxBarH);
  const hPi = Math.max(4, (pi / total) * maxBarH);
  const hCyber = Math.max(4, (cyber / total) * maxBarH);
  const hIpt = Math.max(4, (ipt / total) * maxBarH);

  setBar('barEl', 'lblEl', 35, hEl, el);
  setBar('barPl', 'lblPl', 95, hPl, pl);
  setBar('barPi', 'lblPi', 155, hPi, pi);
  setBar('barCyber', 'lblCyber', 215, hCyber, cyber);
  setBar('barIpt', 'lblIpt', 275, hIpt, ipt);
}

function setBar(barId, lblId, x, h, val) {
  const bar = document.getElementById(barId);
  const lbl = document.getElementById(lblId);
  if (bar) {
    bar.setAttribute('height', h.toFixed(1));
    bar.setAttribute('y', (170 - h).toFixed(1));
  }
  if (lbl) {
    lbl.textContent = fmtGBP(val);
    lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['industry', 'employeeCount', 'turnover', 'plLimit', 'hasEL', 'hasPI', 'hasCyber'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
