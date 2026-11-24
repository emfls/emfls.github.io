import { calcBtlIcrStressTest } from './model.mjs';

function fmtGBP(val) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const propertyValue = parseFloat(document.getElementById('propertyValue').value) || 0;
  const monthlyRent = parseFloat(document.getElementById('monthlyRent').value) || 0;
  const payRate = parseFloat(document.getElementById('payRate').value) || 4.85;
  const mortgageTermType = document.getElementById('mortgageTermType').value;
  const borrowerStructure = document.getElementById('borrowerStructure').value;
  const targetLtvPercent = parseFloat(document.getElementById('targetLtvPercent').value) || 75;
  const maxLtvCapPercent = parseFloat(document.getElementById('maxLtvCapPercent').value) || 75;

  const res = calcBtlIcrStressTest({
    propertyValue,
    monthlyRent,
    payRate,
    mortgageTermType,
    borrowerStructure,
    targetLtvPercent,
    maxLtvCapPercent
  });

  // Display hero results
  document.getElementById('resMaxLoan').textContent = fmtGBP(res.actualMaxLoan);
  document.getElementById('resTargetLoan').textContent = fmtGBP(res.targetLoanRequested);
  document.getElementById('resStressRateUsed').textContent = `${res.effectiveStressRate.toFixed(2)}% (${res.mortgageTermType === '5yr_fixed' ? '5-Yr Relief' : '2-Yr PRA Stress'})`;
  document.getElementById('resIcrRatio').textContent = `${(res.icrMultiplier * 100).toFixed(0)}% ICR`;

  // Status badge & shortfall
  const statusEl = document.getElementById('resStatusBadge');
  const shortfallRow = document.getElementById('shortfallRow');
  if (res.passesStressTest) {
    statusEl.textContent = '✅ PASS - Target Loan Fully Approved';
    statusEl.className = 'status-badge pass';
    shortfallRow.style.display = 'none';
  } else {
    statusEl.textContent = '❌ FAIL - Rent Stress Shortfall';
    statusEl.className = 'status-badge fail';
    shortfallRow.style.display = 'flex';
    document.getElementById('resDepositShortfall').textContent = fmtGBP(res.extraDepositNeeded);
  }

  // Details
  document.getElementById('resMinRentNeeded').textContent = fmtGBP(res.minRequiredMonthlyRent);
  document.getElementById('resLimitingFactor').textContent = res.isConstrainedByIcr ? 'Rental Income (ICR)' : '75% LTV Property Cap';
  document.getElementById('resSpvAdvantage').textContent = fmtGBP(res.spvBorrowingAdvantage);

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const spv = res.spvEffectiveLoan;
  const personal = res.personalEffectiveLoan;
  const target = res.targetLoanRequested;
  const maxVal = Math.max(spv, personal, target, 1);

  const maxH = 140;
  const hSpv = Math.max(6, (spv / maxVal) * maxH);
  const hPersonal = Math.max(6, (personal / maxVal) * maxH);
  const hTarget = Math.max(6, (target / maxVal) * maxH);

  setBar('barSpv', 'lblSpv', 45, hSpv, spv);
  setBar('barPersonal', 'lblPersonal', 135, hPersonal, personal);
  setBar('barTarget', 'lblTarget', 225, hTarget, target);
}

function setBar(barId, lblId, x, h, val) {
  const bar = document.getElementById(barId);
  const lbl = document.getElementById(lblId);
  if (bar) {
    bar.setAttribute('height', h.toFixed(1));
    bar.setAttribute('y', (170 - h).toFixed(1));
  }
  if (lbl) {
    lbl.textContent = fmtGBP(val);
    lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['propertyValue', 'monthlyRent', 'payRate', 'mortgageTermType', 'borrowerStructure', 'targetLtvPercent', 'maxLtvCapPercent'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
