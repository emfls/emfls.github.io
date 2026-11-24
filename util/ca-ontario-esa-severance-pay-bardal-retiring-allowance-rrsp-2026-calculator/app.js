import { calcOntarioSeveranceBardal } from './model.mjs';

function fmtCAD(val) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const annualSalary = parseFloat(document.getElementById('annualSalary').value) || 0;
  const yearsOfService = parseFloat(document.getElementById('yearsOfService').value) || 0;
  const completedMonths = parseFloat(document.getElementById('completedMonths').value) || 0;
  const age = parseFloat(document.getElementById('age').value) || 50;
  const jobRole = document.getElementById('jobRole').value;
  const employerPayrollOver2_5M = document.getElementById('employerPayrollOver2_5M').checked;
  const startYear = parseInt(document.getElementById('startYear').value, 10) || 2010;
  const pre1989NonVestedYears = parseInt(document.getElementById('pre1989NonVestedYears').value, 10) || 0;
  const rrspRolloverPercent = parseFloat(document.getElementById('rrspRolloverPercent').value) || 100;
  const marginalTaxRate = parseFloat(document.getElementById('marginalTaxRate').value) || 43;

  const res = calcOntarioSeveranceBardal({
    annualSalary,
    yearsOfService,
    completedMonths,
    age,
    jobRole,
    employerPayrollOver2_5M,
    startYear,
    pre1989NonVestedYears,
    rrspRolloverPercent,
    marginalTaxRate
  });

  // Display results
  document.getElementById('resBardalTotal').textContent = fmtCAD(res.bardalTotalPayout);
  document.getElementById('resBardalWeeks').textContent = `${res.bardalNoticeWeeks} weeks (~${(res.bardalNoticeWeeks / 4.33).toFixed(1)} months)`;
  document.getElementById('resEsaTotal').textContent = fmtCAD(res.esaTotalPayout);
  document.getElementById('resEsaWeeks').textContent = `${res.esaTotalWeeks} weeks (Notice: ${res.esaNoticeWeeks}w, Severance: ${res.esaSeveranceWeeks}w)`;
  document.getElementById('resGapAmount').textContent = fmtCAD(res.severanceGapPayout);
  document.getElementById('resGapWeeks').textContent = `+${res.severanceGapWeeks} weeks additional compensation`;

  // Retiring Allowance RRSP Section
  document.getElementById('resCraLimit').textContent = fmtCAD(res.craRolloverLimit);
  document.getElementById('resRrspTransferred').textContent = fmtCAD(res.rrspRolloverTransferred);
  document.getElementById('resTaxSheltered').textContent = fmtCAD(res.taxShelteredByRollover);
  document.getElementById('resWithholdingTax').textContent = fmtCAD(res.craWithholdingTax);
  document.getElementById('resNetCash').textContent = fmtCAD(res.netCashInHand);

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const maxVal = Math.max(res.bardalTotalPayout, 1);
  const maxH = 140;

  const hEsa = Math.max(6, (res.esaTotalPayout / maxVal) * maxH);
  const hBardal = Math.max(6, (res.bardalTotalPayout / maxVal) * maxH);
  const hRrsp = Math.max(6, (res.rrspRolloverTransferred / maxVal) * maxH);
  const hCash = Math.max(6, (res.netCashInHand / maxVal) * maxH);

  setBar('barEsa', 'lblEsa', 35, hEsa, res.esaTotalPayout);
  setBar('barBardal', 'lblBardal', 105, hBardal, res.bardalTotalPayout);
  setBar('barRrsp', 'lblRrsp', 175, hRrsp, res.rrspRolloverTransferred);
  setBar('barCash', 'lblCash', 245, hCash, res.netCashInHand);
}

function setBar(barId, lblId, x, h, val) {
  const bar = document.getElementById(barId);
  const lbl = document.getElementById(lblId);
  if (bar) {
    bar.setAttribute('height', h.toFixed(1));
    bar.setAttribute('y', (170 - h).toFixed(1));
  }
  if (lbl) {
    lbl.textContent = fmtCAD(val);
    lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['annualSalary', 'yearsOfService', 'completedMonths', 'age', 'jobRole', 'employerPayrollOver2_5M', 'startYear', 'pre1989NonVestedYears', 'rrspRolloverPercent', 'marginalTaxRate'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
