import { computeDebtConsolidation } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n); }

function update() {
  const debt = parseFloat(document.getElementById('unsecuredDebt').value) || 30000;
  const ccRate = parseFloat(document.getElementById('ccRate').value) / 100 || 0.2099;
  const loanRate = parseFloat(document.getElementById('loanRate').value) / 100 || 0.1030;
  const mortRate = parseFloat(document.getElementById('mortRate').value) / 100 || 0.0620;
  const termYears = parseInt(document.getElementById('termYears').value, 10) || 30;

  const res = computeDebtConsolidation({
    unsecuredDebt: debt,
    creditCardRate: ccRate,
    personalLoanRate: loanRate,
    mortgageRate: mortRate,
    mortgageTermYears: termYears
  });

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setEl('outTrapMonthly', fmt(res.mortgageTrap.monthlyPayment) + '/mo');
  setEl('outTrapInterest', fmt(res.mortgageTrap.totalInterest));
  setEl('outTrapCost', fmt(res.mortgageTrap.trapCostVsPersonalLoan));

  setEl('outShadowMonthly', fmt(res.shadowStrategy.monthlyPayment) + '/mo');
  setEl('outShadowInterest', fmt(res.shadowStrategy.totalInterest));
  setEl('outShadowSavings', fmt(res.shadowStrategy.savingsVsTrap));

  setEl('outLoanMonthly', fmt(res.personalLoan.monthlyPayment) + '/mo');
  setEl('outLoanInterest', fmt(res.personalLoan.totalInterest));

  setEl('outCcMonthly', fmt(res.creditCard.monthlyPayment) + '/mo');
  setEl('outCcInterest', fmt(res.creditCard.totalInterest));
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
