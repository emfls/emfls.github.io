import { calcAtoSmallBizCgt } from './model.mjs';

function fmtAUD(val) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const capitalGain = parseFloat(document.getElementById('capitalGain').value) || 0;
  const entityType = document.getElementById('entityType').value || 'individual';
  const heldOver12Months = document.getElementById('heldOver12Months').value === 'true';
  const netAssetValue = parseFloat(document.getElementById('netAssetValue').value) || 0;
  const annualTurnover = parseFloat(document.getElementById('annualTurnover').value) || 0;
  const yearsOwned = parseFloat(document.getElementById('yearsOwned').value) || 0;
  const taxpayerAge = parseInt(document.getElementById('taxpayerAge').value, 10) || 55;
  const isRetiringOrIncapacitated = document.getElementById('isRetiringOrIncapacitated').value === 'true';
  const applyActiveAssetReduction = document.getElementById('applyActiveAssetReduction').value === 'true';
  const lifetimeRetirementUsed = parseFloat(document.getElementById('lifetimeRetirementUsed').value) || 0;
  const marginalTaxRate = parseFloat(document.getElementById('marginalTaxRate').value) || 45;

  const res = calcAtoSmallBizCgt({
    capitalGain,
    entityType,
    heldOver12Months,
    netAssetValue,
    annualTurnover,
    yearsOwned,
    taxpayerAge,
    isRetiringOrIncapacitated,
    applyActiveAssetReduction,
    lifetimeRetirementUsed,
    marginalTaxRate
  });

  const verdictEl = document.getElementById('cgtVerdict');
  const detailsEl = document.getElementById('cgtDetails');

  if (!res.isEligible) {
    verdictEl.innerHTML = `<span class="badge badge-danger">INELIGIBLE FOR SMALL BUSINESS CONCESSIONS</span>`;
    detailsEl.textContent = res.ineligibilityReason;
    document.getElementById('fifteenYearRow').style.display = 'none';
  } else if (res.fifteenYearExemptionApplied) {
    verdictEl.innerHTML = `<span class="badge badge-success">100% TAX-FREE (15-YEAR EXEMPTION APPLIED)</span>`;
    detailsEl.innerHTML = `Asset held ≥ 15 years and owner aged 55+ retiring. Entire <strong>${fmtAUD(res.grossGain)}</strong> gain is completely exempt from Australian CGT!`;
  } else {
    verdictEl.innerHTML = `<span class="badge badge-success">CONCESSIONS APPLIED: EFFECTIVE TAX ${res.effectiveTaxRate}%</span>`;
    let superNote = res.superContributionMandatory
      ? `<br><strong style="color:#b45309;">Notice:</strong> Taxpayer is under 55; the ${fmtAUD(res.retirementExemptionAmount)} retirement exemption must be rolled directly into super!`
      : '';
    detailsEl.innerHTML = `Small Business concessions shelter ${fmtAUD(res.taxSaved)} in CGT liabilities. Taxable gain reduced to <strong>${fmtAUD(res.netTaxableGain)}</strong>.${superNote}`;
  }

  document.getElementById('grossGainText').textContent = fmtAUD(res.grossGain);
  document.getElementById('generalDiscountText').textContent = res.generalDiscountApplied ? `-${fmtAUD(res.generalDiscountAmount)}` : '$0';
  document.getElementById('activeAssetReductionText').textContent = res.activeAssetReductionApplied ? `-${fmtAUD(res.activeAssetReductionAmount)}` : '$0';
  document.getElementById('retirementExemptionText').textContent = res.retirementExemptionAmount > 0 ? `-${fmtAUD(res.retirementExemptionAmount)}` : '$0';
  document.getElementById('netTaxableGain').textContent = fmtAUD(res.netTaxableGain);
  document.getElementById('estimatedTax').textContent = fmtAUD(res.taxPayable);
  document.getElementById('cgtSaved').textContent = fmtAUD(res.taxSaved);

  renderWaterfallChart(res);
}

function renderWaterfallChart(res) {
  const svg = document.getElementById('waterfallChart');
  if (!svg) return;

  const maxVal = Math.max(res.grossGain, 1000) * 1.15;
  const grossH = (res.grossGain / maxVal) * 160;
  const netH = maxVal > 0 ? (res.netTaxableGain / maxVal) * 160 : 0;
  const grossY = 190 - grossH;
  const netY = 190 - netH;

  svg.innerHTML = `
    <rect x="0" y="0" width="100%" height="220" fill="#f8fafc" rx="8"/>
    <line x1="30" y1="190" x2="370" y2="190" stroke="#cbd5e1" stroke-width="2"/>
    <!-- Gross Gain -->
    <rect x="60" y="${grossY}" width="80" height="${grossH}" fill="#ef4444" rx="4"/>
    <text x="100" y="${grossY - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#ef4444">${fmtAUD(res.grossGain)}</text>
    <text x="100" y="208" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">Gross Gain</text>
    <!-- Net Taxable -->
    <rect x="240" y="${netY}" width="80" height="${netH}" fill="#16a34a" rx="4"/>
    <text x="280" y="${netY - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#16a34a">${fmtAUD(res.netTaxableGain)}</text>
    <text x="280" y="208" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">Taxable Gain</text>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = [
    'capitalGain', 'entityType', 'heldOver12Months', 'netAssetValue',
    'annualTurnover', 'yearsOwned', 'taxpayerAge', 'isRetiringOrIncapacitated',
    'applyActiveAssetReduction', 'lifetimeRetirementUsed', 'marginalTaxRate'
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
