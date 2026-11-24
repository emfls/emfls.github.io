import { calcLiraUnlocking, CA_LIRA_CONSTANTS_2026 } from './model.mjs';

function formatCAD(val) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const liraBalance = parseFloat(document.getElementById('liraBalance').value) || 300000;
  const currentAge = parseFloat(document.getElementById('currentAge').value) || 60;
  const annualReturnPercent = parseFloat(document.getElementById('annualReturn').value) || 5.0;
  const targetAnnualCashNeeded = parseFloat(document.getElementById('targetCash').value) || 30000;
  const unlockFiftyPercent = document.getElementById('unlockFiftyPercent').checked;

  const result = calcLiraUnlocking({
    liraBalance,
    currentAge,
    annualReturnPercent,
    unlockFiftyPercent,
    targetAnnualCashNeeded
  });

  // Summary Badges
  if (result.isSmallBalanceEligible) {
    document.getElementById('smallBalBadge').innerText = 'Eligible for 100% Small Balance Unlocking!';
    document.getElementById('smallBalBadge').className = 'pill-tag bg-emerald';
    document.getElementById('summaryText').innerHTML = `Your balance of <strong>${formatCAD(result.liraBalance)}</strong> is below the 2026 small balance threshold of <strong>${formatCAD(result.smallBalanceThreshold)}</strong> (40% of YMPE). You can unlock <strong>100%</strong> of the funds into a cash or flexible RRSP!`;
  } else {
    document.getElementById('smallBalBadge').innerText = 'Standard 50% Unlocking Rule Applies';
    document.getElementById('smallBalBadge').className = 'pill-tag bg-blue';
    document.getElementById('summaryText').innerHTML = `At age ${result.currentAge}, standard LIF statutory max withdrawal is capped at <strong>${result.maxWithdrawalRatePercent}%</strong> (${formatCAD(result.noUnlockMaxWithdrawal)}). Executing a 50% unlock transfers <strong>${formatCAD(result.unlockedAmount)}</strong> into a flexible RRSP/RRIF with zero maximum cap!`;
  }

  // Without Unlocking
  document.getElementById('noUnlockMin').innerText = formatCAD(result.noUnlockMinWithdrawal);
  document.getElementById('noUnlockMax').innerText = formatCAD(result.noUnlockMaxWithdrawal);
  document.getElementById('noUnlockShortfall').innerText = result.shortfallNoUnlock > 0 ? `-${formatCAD(result.shortfallNoUnlock)} Shortfall` : 'Full Coverage';
  document.getElementById('noUnlockShortfall').style.color = result.shortfallNoUnlock > 0 ? '#f87171' : '#34d399';

  // With 50% Unlocking
  document.getElementById('unlockedTransfer').innerText = formatCAD(result.unlockedAmount);
  document.getElementById('remainingLif').innerText = formatCAD(result.remainingLifBalance);
  document.getElementById('unlockedLifMax').innerText = formatCAD(result.unlockedLifMaxWithdrawal);
  document.getElementById('totalPotentialCash').innerText = formatCAD(result.totalMaxPotentialCashYear1);
  document.getElementById('extraCashAvail').innerText = `+${formatCAD(result.extraCashFlexibility)}`;

  // Table snapshot
  const tbody = document.getElementById('projBody');
  tbody.innerHTML = '';
  result.projection.slice(0, 8).forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Year ${row.year} (Age ${row.age})</td>
      <td>${formatCAD(row.maxWithoutUnlock)}</td>
      <td>${formatCAD(row.balWithoutUnlock)}</td>
      <td style="color:#34d399;font-weight:600;">${formatCAD(row.totalBalWithUnlock)}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('.calc-input');
  inputs.forEach(inp => inp.addEventListener('input', updateCalculator));
  document.getElementById('unlockFiftyPercent').addEventListener('change', updateCalculator);
  updateCalculator();
});
