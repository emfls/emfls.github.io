import { calcOffsetVsEtfVsSuper, ATO_CONSTANTS_2026 } from './model.mjs';

function formatAUD(val) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const taxableIncome = parseFloat(document.getElementById('taxableIncome').value) || 150000;
  const lumpSum = parseFloat(document.getElementById('lumpSum').value) || 20000;
  const monthlyContribution = parseFloat(document.getElementById('monthlyContribution').value) || 500;
  const mortgageRate = parseFloat(document.getElementById('mortgageRate').value) || 6.20;
  const etfTotalReturn = parseFloat(document.getElementById('etfTotalReturn').value) || 8.50;
  const years = parseFloat(document.getElementById('years').value) || 15;
  const div293Applies = document.getElementById('div293Applies').checked;

  const result = calcOffsetVsEtfVsSuper({
    taxableIncome,
    lumpSum,
    monthlyContribution,
    mortgageRate,
    etfTotalReturn,
    years,
    div293Applies
  });

  // Summary Banner
  document.getElementById('winnerBadge').innerText = `${result.winner} Wins`;
  document.getElementById('equivReturnBadge').innerText = `Requires ${result.equivalentGrossReturn}% Pre-Tax Return to Beat Offset`;
  document.getElementById('summaryText').innerHTML = `For your <strong>${result.marginalRatePercent}%</strong> marginal tax bracket, your mortgage offset guarantees a tax-free <strong>${mortgageRate.toFixed(2)}%</strong> return (equivalent to earning <strong>${result.equivalentGrossReturn}%</strong> in a taxable bank deposit). Meanwhile, super salary sacrifice delivers an instant <strong>+${result.upfrontAlphaPercent}%</strong> upfront capital alpha.`;

  // Net Wealth outputs
  document.getElementById('offsetTotalDisplay').innerText = formatAUD(result.offsetNetWealth);
  document.getElementById('etfTotalDisplay').innerText = formatAUD(result.etfNetWealth);
  document.getElementById('superTotalDisplay').innerText = formatAUD(result.superNetWealth);

  // Milestone comparison
  document.getElementById('off10').innerText = formatAUD(result.snap10.offset);
  document.getElementById('etf10').innerText = formatAUD(result.snap10.etf);
  document.getElementById('sup10').innerText = formatAUD(result.snap10.super);

  document.getElementById('off20').innerText = formatAUD(result.snap20.offset);
  document.getElementById('etf20').innerText = formatAUD(result.snap20.etf);
  document.getElementById('sup20').innerText = formatAUD(result.snap20.super);

  // Key metrics
  document.getElementById('cgtDeducted').innerText = `-${formatAUD(result.cgtPaidOnExit)}`;
  document.getElementById('monthlySuperEquivalent').innerText = formatAUD(result.monthlySuperDeposit);
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('.calc-input');
  inputs.forEach(inp => inp.addEventListener('input', updateCalculator));
  document.getElementById('div293Applies').addEventListener('change', updateCalculator);
  updateCalculator();
});
