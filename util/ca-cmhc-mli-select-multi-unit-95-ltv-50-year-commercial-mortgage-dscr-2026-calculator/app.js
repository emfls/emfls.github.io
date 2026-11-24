import { computeCMHCMLISelect } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n); }
function fmtPct(n) { return n.toFixed(2) + '%'; }

function update() {
  const propVal = parseFloat(document.getElementById('propVal').value) || 5000000;
  const noi = parseFloat(document.getElementById('noi').value) || 280000;
  const points = parseInt(document.getElementById('points').value, 10) || 100;
  const cmhcRate = parseFloat(document.getElementById('cmhcRate').value) / 100 || 0.0465;
  const convRate = parseFloat(document.getElementById('convRate').value) / 100 || 0.0585;

  const res = computeCMHCMLISelect({
    propertyValue: propVal,
    annualNOI: noi,
    tierPoints: points,
    interestRateCMHC: cmhcRate,
    interestRateConventional: convRate
  });

  document.getElementById('outEquitySaved').textContent = fmt(res.equitySaved);
  document.getElementById('outLoanCMHC').textContent = fmt(res.cmhc.eligibleLoan) + ' (' + res.cmhc.bindingConstraint + ')';
  document.getElementById('outDownCMHC').textContent = fmt(res.cmhc.downPayment);
  document.getElementById('outMonthlyCMHC').textContent = fmt(res.cmhc.monthlyPayment);
  document.getElementById('outCashFlowCMHC').textContent = fmt(res.cmhc.netCashFlow) + '/yr';
  document.getElementById('outCoCCMHC').textContent = fmtPct(res.cmhc.cashOnCashReturn);

  document.getElementById('outLoanConv').textContent = fmt(res.conventional.eligibleLoan);
  document.getElementById('outDownConv').textContent = fmt(res.conventional.downPayment);
  document.getElementById('outMonthlyConv').textContent = fmt(res.conventional.monthlyPayment);
  document.getElementById('outCashFlowConv').textContent = fmt(res.conventional.netCashFlow) + '/yr';
  document.getElementById('outCoCConv').textContent = fmtPct(res.conventional.cashOnCashReturn);
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
