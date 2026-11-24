import { calcAuBusinessInsuranceDuty, AU_STATE_DUTY_RATES_2026 } from './model.mjs';

function fmtAUD(val) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const stateCode = document.getElementById('stateCode').value;
  const plLimit = document.getElementById('plLimit').value;
  const piLimit = document.getElementById('piLimit').value;
  const cyberLimit = document.getElementById('cyberLimit').value;
  const turnover = parseFloat(document.getElementById('turnover').value) || 0;
  const isGstRegistered = document.getElementById('isGstRegistered').checked;
  const nswSmallBusinessExemption = document.getElementById('nswSmallBusinessExemption').checked;

  const nswGroup = document.getElementById('nswExemptionGroup');
  if (stateCode === 'NSW') {
    nswGroup.style.display = 'block';
  } else {
    nswGroup.style.display = 'none';
  }

  const res = calcAuBusinessInsuranceDuty({
    stateCode,
    plLimit,
    piLimit,
    cyberLimit,
    turnover,
    isGstRegistered,
    nswSmallBusinessExemption
  });

  // Display hero results
  document.getElementById('resTotalInvoice').textContent = fmtAUD(res.totalInvoiceAmount);
  document.getElementById('resMonthly').textContent = fmtAUD(res.monthlyCost);
  document.getElementById('resTaxLoadPercent').textContent = `${res.effectiveCombinedTaxRate.toFixed(1)}% Combined Tax Load`;
  document.getElementById('resNetCost').textContent = fmtAUD(res.netAfterGstCost);

  // Breakdown
  document.getElementById('resBasePremium').textContent = fmtAUD(res.totalBasePremium);
  document.getElementById('resGst').textContent = fmtAUD(res.gstAmount);
  document.getElementById('resStampDuty').textContent = fmtAUD(res.stampDutyAmount);
  document.getElementById('resDutyRate').textContent = `${res.appliedDutyRate.toFixed(1)}% on (Base + GST)`;
  document.getElementById('resGstClaimed').textContent = fmtAUD(res.claimableGstCredit);

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const comps = res.stateComparisons;
  if (!comps) return;

  const states = ['ACT', 'VIC', 'NSW', 'QLD', 'WA', 'SA'];
  const maxVal = Math.max(...states.map(s => comps[s] ? comps[s].total : 1), 1);
  const maxH = 140;

  states.forEach((st, i) => {
    const data = comps[st];
    if (!data) return;
    const h = Math.max(6, (data.total / maxVal) * maxH);
    const bar = document.getElementById(`bar_${st}`);
    const lbl = document.getElementById(`lbl_${st}`);
    if (bar) {
      bar.setAttribute('height', h.toFixed(1));
      bar.setAttribute('y', (170 - h).toFixed(1));
    }
    if (lbl) {
      lbl.textContent = fmtAUD(data.total);
      lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['stateCode', 'plLimit', 'piLimit', 'cyberLimit', 'turnover', 'isGstRegistered', 'nswSmallBusinessExemption'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
