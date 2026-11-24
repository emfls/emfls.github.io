import { computeInsolvencyOptions } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n); }

function update() {
  const debt = parseFloat(document.getElementById('unsecuredDebt').value) || 50000;
  const size = parseInt(document.getElementById('familySize').value, 10) || 4;
  const income = parseFloat(document.getElementById('netIncome').value) || 6000;
  const expenses = parseFloat(document.getElementById('nonDiscExp').value) || 300;
  const settlement = parseFloat(document.getElementById('settlementPct').value) / 100 || 0.35;

  const res = computeInsolvencyOptions({
    unsecuredDebt: debt,
    familySize: size,
    netMonthlyIncome: income,
    nonDiscretionaryExpenses: expenses,
    proposalSettlementPct: settlement
  });

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setEl('outOsbThreshold', fmt(res.bankruptcy.threshold));
  setEl('outExcess', fmt(res.bankruptcy.excess));
  setEl('outSurplusPmt', fmt(res.bankruptcy.monthlySurplusPayment) + '/mo');
  setEl('outDischargeMonths', res.bankruptcy.bankruptcyMonths + ' Months');
  setEl('outTotalBankruptcy', fmt(res.bankruptcy.totalBankruptcyCost));

  setEl('outProposalPmt', fmt(res.proposal.monthlyPayment) + '/mo');
  setEl('outProposalTotal', fmt(res.proposal.totalCost));
  setEl('outForgiven', fmt(res.proposal.debtForgiven));
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
