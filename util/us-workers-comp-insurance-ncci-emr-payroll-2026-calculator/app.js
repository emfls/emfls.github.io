import { calcWorkersComp, NCCI_CLASS_CODES_2026 } from './model.mjs';

function fmtUSD(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const payroll = parseFloat(document.getElementById('payroll').value) || 0;
  const ncciCode = document.getElementById('ncciCode').value;
  const customRateRow = document.getElementById('customRateRow');
  const customRate = parseFloat(document.getElementById('customRate').value) || 0;
  const emr = parseFloat(document.getElementById('emr').value) || 1.0;
  const expenseConstant = parseFloat(document.getElementById('expenseConstant').value) || 250;
  const triaRate = parseFloat(document.getElementById('triaRate').value) || 0.02;
  const stateAssessmentRate = parseFloat(document.getElementById('stateAssessmentRate').value) || 2.5;

  if (ncciCode === 'custom') {
    customRateRow.style.display = 'block';
  } else {
    customRateRow.style.display = 'none';
  }

  const res = calcWorkersComp({
    payroll,
    ncciCode,
    customRate,
    emr,
    expenseConstant,
    triaRate,
    stateAssessmentRate
  });

  // Display results
  document.getElementById('resTotalAnnual').textContent = fmtUSD(res.totalAnnualPremium);
  document.getElementById('resMonthly').textContent = fmtUSD(res.monthlyPremium);
  document.getElementById('resManualPremium').textContent = fmtUSD(res.manualPremium);
  document.getElementById('resEmrFactor').textContent = res.emr.toFixed(2);

  const emrAdjEl = document.getElementById('resEmrAdjustment');
  if (res.isEmrCredit) {
    emrAdjEl.textContent = `-${fmtUSD(Math.abs(res.emrAdjustment))} (Credit Discount)`;
    emrAdjEl.className = 'res-val text-success';
  } else if (res.isEmrDebit) {
    emrAdjEl.textContent = `+${fmtUSD(res.emrAdjustment)} (Debit Surcharge)`;
    emrAdjEl.className = 'res-val text-danger';
  } else {
    emrAdjEl.textContent = '$0 (Neutral)';
    emrAdjEl.className = 'res-val';
  }

  document.getElementById('resModifiedPremium').textContent = fmtUSD(res.modifiedPremium);
  document.getElementById('resTriaFee').textContent = fmtUSD(res.triaSurcharge);
  document.getElementById('resAssessment').textContent = fmtUSD(res.stateAssessment);
  document.getElementById('resCostPerK').textContent = fmtUSD(res.costPerThousandPayroll);

  // Benchmarks & ROI
  document.getElementById('res3YrSavings080').textContent = fmtUSD(res.benchmarks.threeYearRoi080);
  document.getElementById('res3YrLoss125').textContent = fmtUSD(res.benchmarks.threeYearLoss125);

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;
  const p080 = res.benchmarks.totalAt080;
  const p100 = res.benchmarks.totalAt100;
  const p125 = res.benchmarks.totalAt125;
  const maxP = Math.max(p125, 1);

  const h080 = Math.max(12, (p080 / maxP) * 140);
  const h100 = Math.max(12, (p100 / maxP) * 140);
  const h125 = Math.max(12, (p125 / maxP) * 140);

  const bar080 = document.getElementById('bar080');
  const bar100 = document.getElementById('bar100');
  const bar125 = document.getElementById('bar125');

  const lbl080 = document.getElementById('lbl080');
  const lbl100 = document.getElementById('lbl100');
  const lbl125 = document.getElementById('lbl125');

  if (bar080) {
    bar080.setAttribute('height', h080.toFixed(1));
    bar080.setAttribute('y', (170 - h080).toFixed(1));
  }
  if (bar100) {
    bar100.setAttribute('height', h100.toFixed(1));
    bar100.setAttribute('y', (170 - h100).toFixed(1));
  }
  if (bar125) {
    bar125.setAttribute('height', h125.toFixed(1));
    bar125.setAttribute('y', (170 - h125).toFixed(1));
  }

  if (lbl080) lbl080.textContent = fmtUSD(p080);
  if (lbl100) lbl100.textContent = fmtUSD(p100);
  if (lbl125) lbl125.textContent = fmtUSD(p125);
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['payroll', 'ncciCode', 'customRate', 'emr', 'expenseConstant', 'triaRate', 'stateAssessmentRate'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
