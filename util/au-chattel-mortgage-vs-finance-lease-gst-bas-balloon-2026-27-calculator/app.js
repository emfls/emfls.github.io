import { calcChattelMortgageVsLease, ATO_CAR_LIMIT_2026_27, ATO_MAX_CAR_GST_2026_27 } from './model.mjs';

function fmtAUD(val) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const assetPrice = parseFloat(document.getElementById('assetPrice').value) || 95000;
  const assetType = document.getElementById('assetType').value || 'commercial';
  const termMonths = parseInt(document.getElementById('termMonths').value, 10) || 60;
  const interestRate = parseFloat(document.getElementById('interestRate').value) || 6.75;
  const balloonPercent = parseFloat(document.getElementById('balloonPercent').value) || 30;
  const corporateTaxRate = parseFloat(document.getElementById('corporateTaxRate').value) || 25;
  const businessUsePercent = parseFloat(document.getElementById('businessUsePercent').value) || 100;

  const res = calcChattelMortgageVsLease({
    assetPrice,
    assetType,
    termMonths,
    interestRate,
    balloonPercent,
    corporateTaxRate,
    businessUsePercent
  });

  // Chattel Mortgage Outputs
  document.getElementById('cmUpfrontGST').textContent = fmtAUD(res.cmUpfrontGST);
  document.getElementById('cmMonthlyPayment').textContent = fmtAUD(res.cmMonthlyPayment) + '/mo';
  document.getElementById('cmTotalRepayments').textContent = fmtAUD(res.cmTotalRepayments);
  document.getElementById('cmTotalInterest').textContent = fmtAUD(res.cmTotalInterest);
  document.getElementById('cmTaxShield').textContent = fmtAUD(res.cmTaxShield);
  document.getElementById('cmNetLifetimeCost').textContent = fmtAUD(res.cmNetLifetimeCost);

  // Finance Lease Outputs
  document.getElementById('leaseMonthlyRental').textContent = fmtAUD(res.leaseMonthlyRentalIncGST) + '/mo';
  document.getElementById('leaseTotalGST').textContent = fmtAUD(res.leaseTotalGSTClaimed);
  document.getElementById('leaseTotalGrossOutflow').textContent = fmtAUD(res.leaseTotalGrossOutflow);
  document.getElementById('leaseTaxShield').textContent = fmtAUD(res.leaseTaxShield);
  document.getElementById('leaseNetLifetimeCost').textContent = fmtAUD(res.leaseNetLifetimeCost);

  // Winner & Verdict
  const verdictEl = document.getElementById('comparisonVerdict');
  const savingsEl = document.getElementById('netSavingsText');
  if (res.winner === 'CHATTEL_MORTGAGE') {
    verdictEl.innerHTML = `<span class="badge badge-success">CHATTEL MORTGAGE WINS</span>`;
    savingsEl.innerHTML = `Chattel Mortgage delivers <strong>${fmtAUD(res.netSavings)}</strong> lower net after-tax cash outflow, primarily driven by immediate upfront BAS GST recovery of <strong>${fmtAUD(res.cmUpfrontGST)}</strong>.`;
  } else {
    verdictEl.innerHTML = `<span class="badge badge-primary">FINANCE LEASE WINS</span>`;
    savingsEl.innerHTML = `Finance Lease saves <strong>${fmtAUD(res.netSavings)}</strong> net cash, offering maximum tax deductibility on full rental payments.`;
  }

  // Update SVG Waterfall Chart
  renderComparisonChart(res);
}

function renderComparisonChart(res) {
  const svg = document.getElementById('comparisonChart');
  if (!svg) return;
  const maxCost = Math.max(res.cmNetLifetimeCost, res.leaseNetLifetimeCost) * 1.15;
  const cmH = maxCost > 0 ? (res.cmNetLifetimeCost / maxCost) * 160 : 0;
  const leaseH = maxCost > 0 ? (res.leaseNetLifetimeCost / maxCost) * 160 : 0;
  const cmY = 190 - cmH;
  const leaseY = 190 - leaseH;

  svg.innerHTML = `
    <rect x="0" y="0" width="100%" height="220" fill="#f8fafc" rx="8"/>
    <line x1="40" y1="190" x2="380" y2="190" stroke="#cbd5e1" stroke-width="2"/>
    <!-- Chattel Mortgage Bar -->
    <rect x="80" y="${cmY}" width="90" height="${cmH}" fill="#0284c7" rx="4"/>
    <text x="125" y="${cmY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#0284c7">${fmtAUD(res.cmNetLifetimeCost)}</text>
    <text x="125" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">Chattel Mtg</text>
    <!-- Finance Lease Bar -->
    <rect x="230" y="${leaseY}" width="90" height="${leaseH}" fill="#6366f1" rx="4"/>
    <text x="275" y="${leaseY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#6366f1">${fmtAUD(res.leaseNetLifetimeCost)}</text>
    <text x="275" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">Finance Lease</text>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = ['assetPrice', 'assetType', 'termMonths', 'interestRate', 'balloonPercent', 'corporateTaxRate', 'businessUsePercent'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateCalculator);
      el.addEventListener('change', updateCalculator);
    }
  });
  updateCalculator();
});
