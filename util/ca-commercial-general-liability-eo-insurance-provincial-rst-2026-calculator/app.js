import { calcCanadaCommercialInsurance, CA_PROVINCIAL_INSURANCE_TAX_2026 } from './model.mjs';

function fmtCAD(val) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const provinceCode = document.getElementById('provinceCode').value;
  const cglLimit = document.getElementById('cglLimit').value;
  const eoLimit = document.getElementById('eoLimit').value;
  const propertyLimit = document.getElementById('propertyLimit').value;
  const cyberLimit = document.getElementById('cyberLimit').value;
  const annualRevenue = parseFloat(document.getElementById('annualRevenue').value) || 0;

  const res = calcCanadaCommercialInsurance({
    provinceCode,
    cglLimit,
    eoLimit,
    propertyLimit,
    cyberLimit,
    annualRevenue
  });

  // Display hero results
  document.getElementById('resTotalAnnual').textContent = fmtCAD(res.totalAnnualCost);
  document.getElementById('resMonthly').textContent = fmtCAD(res.monthlyCost);
  document.getElementById('resBasePremium').textContent = fmtCAD(res.totalBasePremium);
  document.getElementById('resProvTax').textContent = fmtCAD(res.provincialTaxAmount);
  document.getElementById('resTaxRateLabel').textContent = `${res.taxRatePercent}% Non-Recoverable Tax`;

  // Cover breakdowns
  document.getElementById('resCgl').textContent = fmtCAD(res.cglBase);
  document.getElementById('resEo').textContent = res.eoBase > 0 ? fmtCAD(res.eoBase) : '$0 (None)';
  document.getElementById('resProp').textContent = res.propBase > 0 ? fmtCAD(res.propBase) : '$0 (None)';
  document.getElementById('resCyber').textContent = res.cyberBase > 0 ? fmtCAD(res.cyberBase) : '$0 (None)';

  // Alert box for non-recoverable tax
  const taxAlert = document.getElementById('taxAlertBox');
  if (res.taxRatePercent > 0) {
    taxAlert.style.display = 'block';
    document.getElementById('resLostTaxAmount').textContent = fmtCAD(res.provincialTaxAmount);
    document.getElementById('resTaxProvinceName').textContent = res.provinceName;
  } else {
    taxAlert.style.display = 'none';
  }

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const comps = res.provinceComparisons;
  if (!comps) return;

  const provs = ['AB', 'SK', 'MB', 'ON', 'QC', 'NL'];
  const maxVal = Math.max(...provs.map(p => comps[p] ? comps[p].totalCost : 1), 1);
  const maxH = 140;

  provs.forEach((p, i) => {
    const data = comps[p];
    if (!data) return;
    const h = Math.max(6, (data.totalCost / maxVal) * maxH);
    const bar = document.getElementById(`bar_${p}`);
    const lbl = document.getElementById(`lbl_${p}`);
    if (bar) {
      bar.setAttribute('height', h.toFixed(1));
      bar.setAttribute('y', (170 - h).toFixed(1));
    }
    if (lbl) {
      lbl.textContent = fmtCAD(data.totalCost);
      lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['provinceCode', 'cglLimit', 'eoLimit', 'propertyLimit', 'cyberLimit', 'annualRevenue'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
