import { HDHP_HSA_CONSTANTS_2026, calcHealthPlanEconomics } from './model.mjs';

function formatUSD(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const coverageType = document.querySelector('input[name="coverage"]:checked').value;
  const is55Plus = document.getElementById('chk-55plus').checked;
  const marginalTaxRate = parseFloat(document.getElementById('tax-bracket').value) || 0.22;
  const stateTaxRate = parseFloat(document.getElementById('state-tax').value) || 0.05;

  const hdhpMonthlyPremium = parseFloat(document.getElementById('hdhp-premium').value) || 120;
  const hdhpDeductible = parseFloat(document.getElementById('hdhp-deductible').value) || (coverageType === 'self' ? 2000 : 4000);
  const hdhpOutOfPocketMax = parseFloat(document.getElementById('hdhp-oop-max').value) || (coverageType === 'self' ? 5000 : 10000);
  const employerHsaContribution = parseFloat(document.getElementById('hdhp-employer-hsa').value) || 750;
  const employeeHsaContribution = parseFloat(document.getElementById('hdhp-employee-hsa').value) || (coverageType === 'self' ? 3650 : 8000);

  const ppoMonthlyPremium = parseFloat(document.getElementById('ppo-premium').value) || 280;
  const ppoDeductible = parseFloat(document.getElementById('ppo-deductible').value) || (coverageType === 'self' ? 750 : 1500);
  const ppoOutOfPocketMax = parseFloat(document.getElementById('ppo-oop-max').value) || (coverageType === 'self' ? 4000 : 8000);

  const res = calcHealthPlanEconomics({
    coverageType,
    is55Plus,
    marginalTaxRate,
    stateTaxRate,
    hdhpMonthlyPremium,
    hdhpDeductible,
    hdhpCoinsurance: 0.20,
    hdhpOutOfPocketMax,
    employerHsaContribution,
    employeeHsaContribution,
    ppoMonthlyPremium,
    ppoDeductible,
    ppoCoinsurance: 0.20,
    ppoOutOfPocketMax
  });

  // Update Summary Badges
  document.getElementById('out-guaranteed-advantage').textContent = formatUSD(res.guaranteedHdhpAdvantage);
  document.getElementById('out-premium-savings').textContent = formatUSD(res.premiumSavings);
  document.getElementById('out-hsa-tax-savings').textContent = formatUSD(res.hsaTaxSavings);
  document.getElementById('out-employer-seed').textContent = formatUSD(employerHsaContribution);
  document.getElementById('out-breakeven-point').textContent = res.breakeven >= 99990 ? 'HDHP wins at ALL spend levels' : `~${formatUSD(res.breakeven)} gross spend`;

  // Update Scenarios
  document.getElementById('low-hdhp-cost').textContent = formatUSD(res.lowUsage.hdhpNetCost);
  document.getElementById('low-ppo-cost').textContent = formatUSD(res.lowUsage.ppoNetCost);
  const lowDiff = res.lowUsage.hdhpSavings;
  document.getElementById('low-winner-badge').textContent = lowDiff >= 0 ? `HDHP saves ${formatUSD(lowDiff)}` : `PPO saves ${formatUSD(-lowDiff)}`;
  document.getElementById('low-winner-badge').className = lowDiff >= 0 ? 'badge success' : 'badge warning';

  document.getElementById('exp-hdhp-cost').textContent = formatUSD(res.expectedUsage.hdhpNetCost);
  document.getElementById('exp-ppo-cost').textContent = formatUSD(res.expectedUsage.ppoNetCost);
  const expDiff = res.expectedUsage.hdhpSavings;
  document.getElementById('exp-winner-badge').textContent = expDiff >= 0 ? `HDHP saves ${formatUSD(expDiff)}` : `PPO saves ${formatUSD(-expDiff)}`;
  document.getElementById('exp-winner-badge').className = expDiff >= 0 ? 'badge success' : 'badge warning';

  document.getElementById('cat-hdhp-cost').textContent = formatUSD(res.catastrophicUsage.hdhpNetCost);
  document.getElementById('cat-ppo-cost').textContent = formatUSD(res.catastrophicUsage.ppoNetCost);
  const catDiff = res.catastrophicUsage.hdhpSavings;
  document.getElementById('cat-winner-badge').textContent = catDiff >= 0 ? `HDHP saves ${formatUSD(catDiff)}` : `PPO saves ${formatUSD(-catDiff)}`;
  document.getElementById('cat-winner-badge').className = catDiff >= 0 ? 'badge success' : 'badge danger';
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(el => {
    el.addEventListener('input', updateCalculator);
    el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
