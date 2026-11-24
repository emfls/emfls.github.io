import { calcIrsOfferInCompromise } from './model.mjs';

function fmtUSD(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const taxDebt = parseFloat(document.getElementById('taxDebt').value) || 85000;
  const cashBankBalances = parseFloat(document.getElementById('cashBankBalances').value) || 0;
  const realEstateFmv = parseFloat(document.getElementById('realEstateFmv').value) || 0;
  const realEstateMortgage = parseFloat(document.getElementById('realEstateMortgage').value) || 0;
  const vehiclesFmv = parseFloat(document.getElementById('vehiclesFmv').value) || 0;
  const vehiclesLoans = parseFloat(document.getElementById('vehiclesLoans').value) || 0;
  const otherAssetsFmv = parseFloat(document.getElementById('otherAssetsFmv').value) || 0;
  const otherAssetsLoans = parseFloat(document.getElementById('otherAssetsLoans').value) || 0;
  const monthlyGrossIncome = parseFloat(document.getElementById('monthlyGrossIncome').value) || 0;
  const monthlyAllowableExpenses = parseFloat(document.getElementById('monthlyAllowableExpenses').value) || 0;
  const monthsRemainingCsed = parseInt(document.getElementById('monthsRemainingCsed').value, 10) || 72;

  const res = calcIrsOfferInCompromise({
    taxDebt,
    cashBankBalances,
    realEstateFmv,
    realEstateMortgage,
    vehiclesFmv,
    vehiclesLoans,
    otherAssetsFmv,
    otherAssetsLoans,
    monthlyGrossIncome,
    monthlyAllowableExpenses,
    monthsRemainingCsed
  });

  document.getElementById('totalEquity').textContent = fmtUSD(res.totalNetRealizableEquity);
  document.getElementById('monthlyDisposable').textContent = fmtUSD(res.monthlyDisposableIncome);

  // Lump Sum
  document.getElementById('rcpLumpSum').textContent = fmtUSD(res.rcpLumpSum);
  document.getElementById('lumpSumDeposit').textContent = fmtUSD(res.lumpSumInitialDeposit);
  document.getElementById('lumpSumSavings').textContent = fmtUSD(res.lumpSumSavings) + ` (${res.lumpSumSavingsPercent}%)`;

  // Periodic
  document.getElementById('rcpPeriodic').textContent = fmtUSD(res.rcpPeriodic);
  document.getElementById('periodicPayment').textContent = fmtUSD(res.periodicMonthlyPayment) + '/mo (24 mos)';
  document.getElementById('periodicSavings').textContent = fmtUSD(res.periodicSavings) + ` (${res.periodicSavingsPercent}%)`;

  // Verdict
  const verdictEl = document.getElementById('oicVerdict');
  const detailsEl = document.getElementById('oicDetails');
  if (res.recommendation === 'VIABLE_OIC') {
    verdictEl.innerHTML = `<span class="badge badge-success">HIGHLY VIABLE OIC CANDIDATE</span>`;
    detailsEl.innerHTML = `Lump-sum offer of <strong>${fmtUSD(res.rcpLumpSum)}</strong> can eliminate your entire <strong>${fmtUSD(res.taxDebt)}</strong> IRS liability, saving <strong>${fmtUSD(res.lumpSumSavings)} (${res.lumpSumSavingsPercent}%)</strong>!`;
  } else if (res.recommendation === 'HIGH_RISK_FULL_PAY_INSTALLMENT') {
    verdictEl.innerHTML = `<span class="badge badge-warning">BORDERLINE: IRS MAY DEMAND INSTALLMENT AGREEMENT</span>`;
    detailsEl.innerHTML = `Your monthly disposable income (${fmtUSD(res.monthlyDisposableIncome)}/mo) allows the IRS to collect ${fmtUSD(res.fullPayCapacity)} before your 10-year CSED expires. Consider maximizing allowable expense categories.`;
  } else {
    verdictEl.innerHTML = `<span class="badge badge-danger">OIC NOT RECOMMENDED (ABILITY TO PAY)</span>`;
    detailsEl.innerHTML = `Your Reasonable Collection Potential exceeds your total tax debt. The IRS will reject Form 656 and require an Installment Agreement.`;
  }

  renderChart(res);
}

function renderChart(res) {
  const svg = document.getElementById('oicChart');
  if (!svg) return;
  const maxVal = Math.max(res.taxDebt, res.rcpPeriodic, res.rcpLumpSum) * 1.15;
  const debtH = maxVal > 0 ? (res.taxDebt / maxVal) * 160 : 0;
  const lumpH = maxVal > 0 ? (res.rcpLumpSum / maxVal) * 160 : 0;
  const perH = maxVal > 0 ? (res.rcpPeriodic / maxVal) * 160 : 0;

  const debtY = 190 - debtH;
  const lumpY = 190 - lumpH;
  const perY = 190 - perH;

  svg.innerHTML = `
    <rect x="0" y="0" width="100%" height="220" fill="#f8fafc" rx="8"/>
    <line x1="30" y1="190" x2="370" y2="190" stroke="#cbd5e1" stroke-width="2"/>
    <!-- Total Tax Debt -->
    <rect x="50" y="${debtY}" width="70" height="${debtH}" fill="#ef4444" rx="4"/>
    <text x="85" y="${debtY - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#ef4444">${fmtUSD(res.taxDebt)}</text>
    <text x="85" y="208" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">IRS Debt</text>
    <!-- Lump Sum OIC -->
    <rect x="160" y="${lumpY}" width="70" height="${lumpH}" fill="#16a34a" rx="4"/>
    <text x="195" y="${lumpY - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#16a34a">${fmtUSD(res.rcpLumpSum)}</text>
    <text x="195" y="208" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">Lump-Sum (12m)</text>
    <!-- Periodic OIC -->
    <rect x="270" y="${perY}" width="70" height="${perH}" fill="#0284c7" rx="4"/>
    <text x="305" y="${perY - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#0284c7">${fmtUSD(res.rcpPeriodic)}</text>
    <text x="305" y="208" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">Periodic (24m)</text>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = [
    'taxDebt', 'cashBankBalances', 'realEstateFmv', 'realEstateMortgage',
    'vehiclesFmv', 'vehiclesLoans', 'otherAssetsFmv', 'otherAssetsLoans',
    'monthlyGrossIncome', 'monthlyAllowableExpenses', 'monthsRemainingCsed'
  ];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateCalculator);
      el.addEventListener('change', updateCalculator);
    }
  });
  updateCalculator();
});
