import { calcAuCarLimit, ATO_CAR_LIMIT_2026_27, ATO_MAX_GST_CREDIT_2026_27 } from './model.mjs';

function fmtAUD(val) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
  const vehicleType = document.getElementById('vehicleType').value;
  const businessUsePercent = parseFloat(document.getElementById('businessUsePercent').value) || 0;
  const isGstRegistered = document.getElementById('isGstRegistered').checked;
  const entityTaxRate = parseFloat(document.getElementById('entityTaxRate').value) || 25;

  const res = calcAuCarLimit({
    purchasePrice,
    vehicleType,
    businessUsePercent,
    isGstRegistered,
    entityTaxRate
  });

  // Display hero results
  document.getElementById('resNetBenefit').textContent = fmtAUD(res.total5YrNetBenefit);
  document.getElementById('resGstClaimable').textContent = fmtAUD(res.maxAllowableGst);
  document.getElementById('resCostBase').textContent = fmtAUD(res.effectiveCostBase);
  document.getElementById('res5YrDeprec').textContent = fmtAUD(res.total5YrDeprec);
  document.getElementById('res5YrTaxSavings').textContent = fmtAUD(res.total5YrIncomeTaxSaved);

  // Cap Warnings & Lost deductions
  const capAlert = document.getElementById('capLossAlert');
  if (res.isPassenger && res.excessAboveCarLimit > 0) {
    capAlert.style.display = 'block';
    document.getElementById('resLostCapAmount').textContent = fmtAUD(res.excessAboveCarLimit);
    document.getElementById('resLostGst').textContent = fmtAUD(res.lostGstCredit);
  } else {
    capAlert.style.display = 'none';
  }

  // Commercial advantage box
  const uteAlert = document.getElementById('uteAdvantageBox');
  if (res.commercialTaxAdvantage > 0) {
    uteAlert.style.display = 'block';
    document.getElementById('resUteAdvantage').textContent = fmtAUD(res.commercialTaxAdvantage);
  } else {
    uteAlert.style.display = 'none';
  }

  updateScheduleTable(res.schedule);
  updateChart(res);
}

function updateScheduleTable(schedule) {
  const tbody = document.getElementById('scheduleBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  schedule.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Year ${row.year}</td>
      <td style="text-align:right;">${fmtAUD(row.depreciation)}</td>
      <td style="text-align:right;">${fmtAUD(row.cumulativeDepreciation)}</td>
      <td style="text-align:right; font-weight:600; color:#15803d;">${fmtAUD(row.taxSaved)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;
  const schedule = res.schedule;
  if (!schedule || schedule.length < 5) return;

  const maxVal = Math.max(res.effectiveCostBase, 1);
  const maxBarH = 140;

  schedule.forEach((row, i) => {
    const yr = i + 1;
    const h = Math.max(4, (row.cumulativeDepreciation / maxVal) * maxBarH);
    const bar = document.getElementById(`barYr${yr}`);
    const lbl = document.getElementById(`lblYr${yr}`);
    if (bar) {
      bar.setAttribute('height', h.toFixed(1));
      bar.setAttribute('y', (170 - h).toFixed(1));
    }
    if (lbl) {
      lbl.textContent = fmtAUD(row.cumulativeDepreciation);
      lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['purchasePrice', 'vehicleType', 'businessUsePercent', 'isGstRegistered', 'entityTaxRate'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
