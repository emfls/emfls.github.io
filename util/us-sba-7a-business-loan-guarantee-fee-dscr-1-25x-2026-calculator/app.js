import { computeSBA7aLoan, getMaxSBASpread } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }
function fmtPct(n) { return (n * 100).toFixed(2) + '%'; }

function update() {
  const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 1000000;
  const primeRate = parseFloat(document.getElementById('primeRate').value) / 100 || 0.0775;
  const spread = parseFloat(document.getElementById('spread').value) / 100 || 0.030;
  const termYears = parseInt(document.getElementById('termYears').value, 10) || 10;
  const annualNOI = parseFloat(document.getElementById('annualNOI').value) || 250000;
  const existingDebt = parseFloat(document.getElementById('existingDebt').value) || 20000;
  const waiver = document.getElementById('waiver').checked;

  const res = computeSBA7aLoan({
    loanAmount,
    wsjPrimeRate: primeRate,
    lenderSpread: spread,
    termYears,
    annualNOI,
    existingAnnualDebt: existingDebt,
    isManufacturerWaiver: waiver
  });

  document.getElementById('outMonthly').textContent = fmt(res.monthlyPayment);
  document.getElementById('outRate').textContent = fmtPct(res.interestRate);
  document.getElementById('outMaxSpread').textContent = 'Max cap: Prime + ' + (res.maxAllowedSpread * 100).toFixed(1) + '%';
  document.getElementById('outFee').textContent = fmt(res.guaranteeFee);
  document.getElementById('outGuaranteed').textContent = fmt(res.guaranteedAmount) + ' (' + ((res.guaranteedAmount/res.loanAmount)*100).toFixed(0) + '%)';
  document.getElementById('outDSCR').textContent = res.dscr.toFixed(2) + 'x';

  const badge = document.getElementById('dscrBadge');
  if (res.dscrPass) {
    badge.textContent = 'PASS (>= 1.25x SOP Benchmark)';
    badge.className = 'badge pass';
    document.getElementById('shortfallBox').style.display = 'none';
  } else {
    badge.textContent = 'FAIL (< 1.25x Underwriting Minimum)';
    badge.className = 'badge fail';
    document.getElementById('shortfallBox').style.display = 'block';
    document.getElementById('outShortfall').textContent = fmt(res.noiShortfall);
  }

  document.getElementById('outTotalInterest').textContent = fmt(res.totalInterest);
  document.getElementById('outTotalCost').textContent = fmt(res.totalRepayment + res.guaranteeFee);
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
