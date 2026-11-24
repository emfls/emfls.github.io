import { calcCanadaSredCredit } from './model.mjs';

function fmtCAD(val) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const directSalaries = parseFloat(document.getElementById('directSalaries').value) || 0;
  const useProxyMethod = document.getElementById('useProxyMethod').value === 'true';
  const contractorCosts = parseFloat(document.getElementById('contractorCosts').value) || 0;
  const materialsCosts = parseFloat(document.getElementById('materialsCosts').value) || 0;
  const taxableCapital = parseFloat(document.getElementById('taxableCapital').value) || 0;
  const isCcpc = document.getElementById('isCcpc').value === 'true';
  const provincialJurisdiction = document.getElementById('provincialJurisdiction').value || 'ontario';

  const res = calcCanadaSredCredit({
    directSalaries,
    useProxyMethod,
    contractorCosts,
    materialsCosts,
    taxableCapital,
    isCcpc,
    provincialJurisdiction
  });

  document.getElementById('qualifiedPool').textContent = fmtCAD(res.totalQualifiedExpenditures);
  document.getElementById('proxyOverheadText').textContent = fmtCAD(res.proxyOverhead);
  document.getElementById('adjustedLimitText').textContent = fmtCAD(res.expenditureLimit2026);

  document.getElementById('refundableItc').textContent = fmtCAD(res.federalRefundableITC);
  document.getElementById('basicItc').textContent = fmtCAD(res.federalBasicITC);
  document.getElementById('provincialCreditText').textContent = fmtCAD(res.provincialCredit);
  document.getElementById('totalFundingText').textContent = fmtCAD(res.totalRndFunding);

  const verdictEl = document.getElementById('c15Advantage');
  if (res.billC15Advantage > 0) {
    verdictEl.innerHTML = `<span class="badge badge-success">BILL C-15 BONUS: +${fmtCAD(res.billC15Advantage)}</span> The $6M expenditure limit and wider $15M–$75M phase-out generate <strong>${fmtCAD(res.billC15Advantage)}</strong> in extra cash credits compared to the pre-2026 regime!`;
  } else {
    verdictEl.innerHTML = `<span class="badge badge-primary">MAXIMUM 35% REFUND ACCESSED</span> Your expenditures fall fully within the enhanced 35% refundable limit!`;
  }

  renderChart(res);
}

function renderChart(res) {
  const svg = document.getElementById('sredChart');
  if (!svg) return;

  const maxVal = Math.max(res.totalRndFunding, res.oldFederalITC, 1000) * 1.2;
  const newH = maxVal > 0 ? (res.totalRndFunding / maxVal) * 160 : 0;
  const oldH = maxVal > 0 ? (res.oldFederalITC / maxVal) * 160 : 0;
  const newY = 190 - newH;
  const oldY = 190 - oldH;

  svg.innerHTML = `
    <rect x="0" y="0" width="100%" height="220" fill="#f8fafc" rx="8"/>
    <line x1="40" y1="190" x2="380" y2="190" stroke="#cbd5e1" stroke-width="2"/>
    <!-- Pre-2026 ITC -->
    <rect x="80" y="${oldY}" width="90" height="${oldH}" fill="#94a3b8" rx="4"/>
    <text x="125" y="${oldY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">${fmtCAD(res.oldFederalITC)}</text>
    <text x="125" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">Old Pre-2026</text>
    <!-- 2026 Bill C-15 Funding -->
    <rect x="230" y="${newY}" width="90" height="${newH}" fill="#0d9488" rx="4"/>
    <text x="275" y="${newY - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#0d9488">${fmtCAD(res.totalRndFunding)}</text>
    <text x="275" y="208" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">2026 Bill C-15</text>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = [
    'directSalaries', 'useProxyMethod', 'contractorCosts', 'materialsCosts',
    'taxableCapital', 'isCcpc', 'provincialJurisdiction'
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
