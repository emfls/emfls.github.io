import { calcAuBonusWithholding } from './model.mjs';

function formatAUD(val) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  }).format(val);
}

function updateCalculator() {
  const salary = parseFloat(document.getElementById('input-salary').value) || 110000;
  const bonus = parseFloat(document.getElementById('input-bonus').value) || 15000;
  const payFreq = document.getElementById('input-freq').value;
  const hasHecs = document.getElementById('input-hecs').checked;
  const sacrifice = parseFloat(document.getElementById('input-sacrifice').value) || 0;
  const priorSuper = parseFloat(document.getElementById('input-prior-super').value) || 12000;

  try {
    const res = calcAuBonusWithholding({
      regularAnnualSalary: salary,
      payFrequency: payFreq,
      bonusAmount: bonus,
      hasHecs,
      salarySacrificeSuper: sacrifice,
      priorSuperContributions: priorSuper
    });

    // Populate Hero Stats
    document.getElementById('out-method-a-takehome').textContent = formatAUD(res.methodA.netTakeHome);
    document.getElementById('out-method-a-withheld').textContent = formatAUD(res.methodA.withholding);
    document.getElementById('out-naive-takehome').textContent = formatAUD(res.naiveMethod.netTakeHome);
    document.getElementById('out-naive-withheld').textContent = formatAUD(res.naiveMethod.withholding);

    document.getElementById('out-sg-amount').textContent = formatAUD(res.superGuaranteeAmount);
    document.getElementById('out-true-tax').textContent = `${formatAUD(res.trueTax.marginalTax)} (${res.trueTax.effectiveRatePct.toFixed(1)}%)`;

    // July Refund
    document.getElementById('out-method-a-refund').textContent = `+$${Math.round(res.methodA.refundInJuly).toLocaleString('en-AU')} Estimated Refund`;
    document.getElementById('out-naive-refund').textContent = `+$${Math.round(res.naiveMethod.refundInJuly).toLocaleString('en-AU')} Massive Refund!`;

    // Salary Sacrifice Callout
    if (res.actualSalarySacrifice > 0) {
      document.getElementById('box-super-sacrifice').style.display = 'block';
      document.getElementById('out-super-saved').textContent = formatAUD(res.superSavings.taxSaved);
      document.getElementById('out-sacrificed-amount').textContent = formatAUD(res.actualSalarySacrifice);
    } else {
      document.getElementById('box-super-sacrifice').style.display = 'none';
    }

    renderChart(res);

  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function renderChart(res) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  const width = 640;
  const height = 220;
  const padding = { top: 25, right: 35, bottom: 35, left: 165 };

  const items = [
    { label: 'Schedule 5 Net Cash', val: res.methodA.netTakeHome, color: '#10b981' },
    { label: 'Naive Net Cash', val: res.naiveMethod.netTakeHome, color: '#3b82f6' },
    { label: 'Schedule 5 Tax Withheld', val: res.methodA.withholding, color: '#f59e0b' },
    { label: 'Naive Tax Withheld', val: res.naiveMethod.withholding, color: '#ef4444' },
    { label: '12% Super Guarantee', val: res.superGuaranteeAmount, color: '#8b5cf6' }
  ];

  const maxVal = Math.max(...items.map(i => i.val)) * 1.18;
  const barHeight = 22;
  const gap = 16;

  const svgBars = items.map((item, i) => {
    const y = padding.top + i * (barHeight + gap);
    const barWidth = Math.max(0, (item.val / maxVal) * (width - padding.left - padding.right));
    return `
      <text x="${padding.left - 10}" y="${y + barHeight / 2 + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${item.label}</text>
      <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${item.color}"/>
      <text x="${padding.left + barWidth + 8}" y="${y + barHeight / 2 + 4}" fill="#fff" font-size="11" font-weight="600">${formatAUD(item.val)}</text>
    `;
  }).join('');

  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="ATO Bonus Withholding Comparison Chart">
      <line x1="${padding.left}" y1="${padding.top - 5}" x2="${padding.left}" y2="${height - padding.bottom + 5}" stroke="#374151" stroke-width="1"/>
      ${svgBars}
    </svg>
  `;

  container.innerHTML = svgHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#input-salary, #input-bonus, #input-freq, #input-hecs, #input-sacrifice, #input-prior-super');
  inputs.forEach(input => input.addEventListener('input', updateCalculator));
  document.getElementById('input-hecs').addEventListener('change', updateCalculator);
  document.getElementById('input-freq').addEventListener('change', updateCalculator);

  updateCalculator();
});
