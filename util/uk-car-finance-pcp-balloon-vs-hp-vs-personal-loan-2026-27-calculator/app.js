import { computeCarFinance } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n); }

function update() {
  const price = parseFloat(document.getElementById('carPrice').value) || 32000;
  const dep = parseFloat(document.getElementById('deposit').value) || 4000;
  const months = parseInt(document.getElementById('termMonths').value, 10) || 48;
  const pcpApr = parseFloat(document.getElementById('pcpApr').value) / 100 || 0.079;
  const balloon = parseFloat(document.getElementById('balloon').value) || 14400;
  const loanApr = parseFloat(document.getElementById('loanApr').value) / 100 || 0.059;
  const contractMiles = parseFloat(document.getElementById('contractMiles').value) || 10000;
  const actualMiles = parseFloat(document.getElementById('actualMiles').value) || 12000;
  const excessPence = parseFloat(document.getElementById('excessPence').value) / 100 || 0.10;

  const res = computeCarFinance({
    carPrice: price,
    deposit: dep,
    termMonths: months,
    pcpApr,
    gmfvBalloon: balloon,
    personalLoanApr: loanApr,
    annualMileageContract: contractMiles,
    actualAnnualMileage: actualMiles,
    excessMileagePence: excessPence
  });

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setEl('outPcpMonthly', fmt(res.pcp.monthlyPayment));
  setEl('outHpMonthly', fmt(res.hp.monthlyPayment));
  setEl('outLoanMonthly', fmt(res.loan.monthlyPayment));

  setEl('outPcpInterest', fmt(res.pcp.totalInterest));
  setEl('outHpInterest', fmt(res.hp.totalInterest));
  setEl('outPcpInterestPremium', fmt(res.pcpInterestPremiumVsHP));

  setEl('outPcpOwnTotal', fmt(res.pcp.totalCostToOwn));
  setEl('outHpTotal', fmt(res.hp.totalCost));
  setEl('outLoanTotal', fmt(res.loan.totalCost));
  setEl('outPcpHandbackTotal', fmt(res.pcp.totalCostHandBack));
  setEl('outExcessPenalty', fmt(res.pcp.excessMileagePenalty));
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
