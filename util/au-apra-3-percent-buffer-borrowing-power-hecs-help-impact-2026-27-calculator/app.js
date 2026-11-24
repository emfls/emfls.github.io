import { evaluateApraBorrowing } from './model.mjs';

const incomeInput = document.getElementById('grossAnnualIncome');
const contractRateInput = document.getElementById('contractRate');
const apraBufferInput = document.getElementById('apraBufferRate');
const termInput = document.getElementById('loanTermYears');
const hecsInput = document.getElementById('hecsHelpBalance');
const ccInput = document.getElementById('creditCardLimit');
const hemInput = document.getElementById('monthlyLivingExpenses');
const otherDebtInput = document.getElementById('otherMonthlyDebt');

const resAssessmentRate = document.getElementById('resAssessmentRate');
const resBaselineBorrowing = document.getElementById('resBaselineBorrowing');
const resActualMonthly = document.getElementById('resActualMonthly');
const resDti = document.getElementById('resDti');
const resHecsUnlocked = document.getElementById('resHecsUnlocked');
const resCardsUnlocked = document.getElementById('resCardsUnlocked');
const resBothUnlocked = document.getElementById('resBothUnlocked');
const resBothTotal = document.getElementById('resBothTotal');
const dtiWarningBox = document.getElementById('dtiWarningBox');
const chartSvg = document.getElementById('capacityChart');

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('en-AU', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderChart(data) {
  if (!chartSvg) return;
  const scenarios = [
    { label: 'Current Baseline', val: data.baseline.borrowingPower, color: '#3b82f6' },
    { label: 'HECS Cleared', val: data.noHecs.borrowingPower, color: '#10b981' },
    { label: 'Cards Closed', val: data.noCards.borrowingPower, color: '#f59e0b' },
    { label: 'Both Cleared', val: data.bothCleared.borrowingPower, color: '#8b5cf6' }
  ];
  const maxVal = Math.max(...scenarios.map(s => s.val), 100000);
  const width = 560;
  const height = 240;
  const barHeight = 32;
  const gap = 20;
  const startY = 30;
  const labelWidth = 140;
  const chartAreaWidth = width - labelWidth - 90;

  let svg = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Borrowing capacity comparison chart">`;
  svg += `<rect width="${width}" height="${height}" fill="#f8fafc" rx="8" />`;

  scenarios.forEach((s, i) => {
    const y = startY + i * (barHeight + gap);
    const barW = Math.max(4, (s.val / maxVal) * chartAreaWidth);
    svg += `<text x="${labelWidth - 10}" y="${y + barHeight / 2 + 5}" font-size="12" font-family="system-ui, sans-serif" text-anchor="end" fill="#334155">${s.label}</text>`;
    svg += `<rect x="${labelWidth}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${s.color}" />`;
    svg += `<text x="${labelWidth + barW + 8}" y="${y + barHeight / 2 + 5}" font-size="12" font-family="system-ui, sans-serif" font-weight="600" fill="#0f172a">${aud.format(s.val)}</text>`;
  });
  svg += `</svg>`;
  chartSvg.innerHTML = svg;
}

function update() {
  try {
    const inputs = {
      grossAnnualIncome: parseFloat(incomeInput.value) || 0,
      contractRate: (parseFloat(contractRateInput.value) || 0) / 100,
      apraBufferRate: (parseFloat(apraBufferInput.value) || 0) / 100,
      loanTermYears: parseInt(termInput.value, 10) || 30,
      hecsHelpBalance: parseFloat(hecsInput.value) || 0,
      creditCardLimit: parseFloat(ccInput.value) || 0,
      monthlyLivingExpenses: parseFloat(hemInput.value) || 0,
      otherMonthlyDebt: parseFloat(otherDebtInput.value) || 0
    };

    const res = evaluateApraBorrowing(inputs);

    if (resAssessmentRate) resAssessmentRate.textContent = pct.format(res.assessmentRate);
    if (resBaselineBorrowing) resBaselineBorrowing.textContent = aud.format(res.baseline.borrowingPower);
    if (resActualMonthly) resActualMonthly.textContent = aud.format(res.baseline.actualMonthlyRepayment) + '/mo';
    if (resDti) resDti.textContent = res.baseline.dti.toFixed(2) + 'x';

    if (resHecsUnlocked) resHecsUnlocked.textContent = '+' + aud.format(res.deltas.hecsUnlockedBorrowing);
    if (resCardsUnlocked) resCardsUnlocked.textContent = '+' + aud.format(res.deltas.cardsUnlockedBorrowing);
    if (resBothUnlocked) resBothUnlocked.textContent = '+' + aud.format(res.deltas.bothUnlockedBorrowing);
    if (resBothTotal) resBothTotal.textContent = aud.format(res.bothCleared.borrowingPower);

    if (dtiWarningBox) {
      if (res.baseline.isHighDti) {
        dtiWarningBox.style.display = 'block';
        dtiWarningBox.textContent = `Warning: Baseline Debt-to-Income (${res.baseline.dti.toFixed(1)}x) exceeds APRA’s 6.0x high-DTI macroprudential limit, triggering heightened bank scrutiny or decline.`;
      } else {
        dtiWarningBox.style.display = 'none';
      }
    }

    renderChart(res);
  } catch (err) {
    console.error(err);
  }
}

[incomeInput, contractRateInput, apraBufferInput, termInput, hecsInput, ccInput, hemInput, otherDebtInput].forEach(el => {
  if (el) el.addEventListener('input', update);
});

update();
