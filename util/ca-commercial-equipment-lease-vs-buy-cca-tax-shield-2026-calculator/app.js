import { calcLeaseVsBuyCanada } from './model.mjs';

function fmtCAD(val) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const equipmentCost = parseFloat(document.getElementById('equipmentCost').value) || 120000;
  const ccaClass = document.getElementById('ccaClass').value || 'class8';
  const acceleratedIncentive = document.getElementById('acceleratedIncentive').value === 'true';
  const usefulLifeYears = parseInt(document.getElementById('usefulLifeYears').value, 10) || 5;
  const salvageValue = parseFloat(document.getElementById('salvageValue').value) || 15000;
  const loanInterestRate = parseFloat(document.getElementById('loanInterestRate').value) || 6.5;
  const downPaymentPercent = parseFloat(document.getElementById('downPaymentPercent').value) || 10;
  const monthlyLeasePayment = parseFloat(document.getElementById('monthlyLeasePayment').value) || 2450;
  const leaseBuyoutResidual = parseFloat(document.getElementById('leaseBuyoutResidual').value) || 10000;
  const corporateTaxRate = parseFloat(document.getElementById('corporateTaxRate').value) || 12.2;
  const discountRate = parseFloat(document.getElementById('discountRate').value) || 7.0;

  const res = calcLeaseVsBuyCanada({
    equipmentCost,
    ccaClass,
    acceleratedIncentive,
    usefulLifeYears,
    salvageValue,
    loanInterestRate,
    downPaymentPercent,
    monthlyLeasePayment,
    leaseBuyoutResidual,
    corporateTaxRate,
    discountRate
  });

  // Buy Results
  document.getElementById('buyDownPayment').textContent = fmtCAD(res.downPayment);
  document.getElementById('buyAnnualLoan').textContent = fmtCAD(res.annualLoanPayment) + '/yr';
  document.getElementById('buyCCAClaimed').textContent = fmtCAD(res.totalCCAClaimed);
  document.getElementById('buyTaxShield').textContent = fmtCAD(res.buyTotalTaxShield);
  document.getElementById('buyNominalCost').textContent = fmtCAD(res.buyNetNominalCost);
  document.getElementById('buyNPV').textContent = fmtCAD(res.buyNPV);

  // Lease Results
  document.getElementById('leaseAnnualCost').textContent = fmtCAD(res.annualLeaseCost) + '/yr';
  document.getElementById('leaseDeductions').textContent = fmtCAD(res.totalLeaseDeductions);
  document.getElementById('leaseTaxShield').textContent = fmtCAD(res.totalLeaseTaxShield);
  document.getElementById('leaseGrossOutflow').textContent = fmtCAD(res.leaseTotalGrossOutflow);
  document.getElementById('leaseNominalCost').textContent = fmtCAD(res.leaseNetNominalCost);
  document.getElementById('leaseNPV').textContent = fmtCAD(res.leaseNPV);

  // Recommendation Verdict
  const verdictEl = document.getElementById('decisionVerdict');
  const savingsEl = document.getElementById('npvSavingsSummary');
  if (res.winner === 'BUY') {
    verdictEl.innerHTML = `<span class="badge badge-success">BUYING RECOMMENDED (NPV ADVANTAGE)</span>`;
    savingsEl.innerHTML = `Purchasing with equipment loan saves <strong>${fmtCAD(res.npvSavings)}</strong> in present value terms compared to leasing, bolstered by <strong>${fmtCAD(res.buyTotalTaxShield)}</strong> in combined CCA and interest tax shields.`;
  } else {
    verdictEl.innerHTML = `<span class="badge badge-primary">LEASING RECOMMENDED (NPV ADVANTAGE)</span>`;
    savingsEl.innerHTML = `Operating Lease saves <strong>${fmtCAD(res.npvSavings)}</strong> in present value terms, delivering steady tax write-offs with zero initial capital lockup.`;
  }

  renderChart(res);
}

function renderChart(res) {
  const svg = document.getElementById('npvChart');
  if (!svg) return;
  const maxVal = Math.max(res.buyNPV, res.leaseNPV) * 1.2;
  const buyH = maxVal > 0 ? (res.buyNPV / maxVal) * 160 : 0;
  const leaseH = maxVal > 0 ? (res.leaseNPV / maxVal) * 160 : 0;
  const buyY = 190 - buyH;
  const leaseY = 190 - leaseH;

  svg.innerHTML = `
    <rect x="0" y="0" width="100%" height="220" fill="#f8fafc" rx="8"/>
    <line x1="40" y1="190" x2="380" y2="190" stroke="#cbd5e1" stroke-width="2"/>
    <!-- Buy Bar -->
    <rect x="80" y="${buyY}" width="90" height="${buyH}" fill="#0d9488" rx="4"/>
    <text x="125" y="${buyY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#0d9488">${fmtCAD(res.buyNPV)}</text>
    <text x="125" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">Buy (NPV)</text>
    <!-- Lease Bar -->
    <rect x="230" y="${leaseY}" width="90" height="${leaseH}" fill="#e11d48" rx="4"/>
    <text x="275" y="${leaseY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#e11d48">${fmtCAD(res.leaseNPV)}</text>
    <text x="275" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">Lease (NPV)</text>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = [
    'equipmentCost', 'ccaClass', 'acceleratedIncentive', 'usefulLifeYears',
    'salvageValue', 'loanInterestRate', 'downPaymentPercent', 'monthlyLeasePayment',
    'leaseBuyoutResidual', 'corporateTaxRate', 'discountRate'
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
